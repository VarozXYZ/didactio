import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import passport from "passport";
import { InMemoryAiConfigStore, type AiConfigStore } from "./ai/config.js";
import { createAiRouter } from "./ai/routes.js";
import { GatewayAiService, type AiService } from "./ai/service.js";
import { createAnalyticsRouter } from "./analytics/routes.js";
import { InMemoryCreditTransactionStore } from "./auth/adapters/memory/credit-transaction-store.js";
import { InMemorySessionStore } from "./auth/adapters/memory/session-store.js";
import { InMemoryUserStore } from "./auth/adapters/memory/user-store.js";
import { createAdminRouter } from "./auth/admin/routes.js";
import { AuthService } from "./auth/core/service.js";
import type {
  AuthConfig,
  AuthenticatedPrincipal,
  CreditTransactionStore,
  SessionStore,
  UserStore,
} from "./auth/core/types.js";
import {
  authErrorHandler,
  createRequireAuth,
  createRequireRole,
} from "./auth/http/middleware.js";
import { createAuthRouter } from "./auth/http/routes.js";
import { configureGooglePassport } from "./auth/passport/google.js";
import {
  InMemoryBillingEventStore,
  type BillingEventStore,
} from "./billing/billing-event-store.js";
import {
  createBillingRouter,
  createBillingWebhookHandler,
} from "./billing/routes.js";
import {
  BillingService,
  type BillingConfig,
  type StripeClientLike,
} from "./billing/service.js";
import { ensureDefaultDidacticUnits } from "./didactic-unit/default-units.js";
import type { DidacticUnitStore } from "./didactic-unit/didactic-unit-store.js";
import { createChapterRouter } from "./didactic-unit/http/chapter-routes.js";
import { createPlanningRouter } from "./didactic-unit/http/planning-routes.js";
import { createDidacticUnitRouter } from "./didactic-unit/http/routes.js";
import {
  InMemoryDidacticUnitNoteStore,
  type DidacticUnitNoteStore,
} from "./didactic-unit/notes/note-store.js";
import { createNotesRouter } from "./didactic-unit/notes/routes.js";
import {
  failDidacticUnitModeration,
  moderateDidacticUnitPlanning,
  rejectDidacticUnitModeration,
} from "./didactic-unit/planning-lifecycle.js";
import { updateDidacticUnitFolder } from "./didactic-unit/update-didactic-unit-folder.js";
import { ensureDefaultFolders } from "./folders/folder-defaults.js";
import type { FolderStore } from "./folders/folder-store.js";
import { createFoldersRouter } from "./folders/routes.js";
import { type GenerationRunStore } from "./generation-runs/generation-run-store.js";
import { createGenerationRunsRouter } from "./generation-runs/routes.js";
import {
  resolveFolderIdFromModelName,
  resolvePublicAiFailureMessage,
} from "./http/api-helpers.js";
import { buildFolderDescription } from "./didactic-unit/http/responses.js";
import { createHealthRouter } from "./http/health-routes.js";
import {
  createApiRateLimitMiddleware,
  InMemoryRateLimiter,
  type ApiRateLimiter,
} from "./http/rate-limit.js";
import type { ProductRouteDependencies } from "./http/route-dependencies.js";
import {
  InMemoryLearningActivityStore,
  type LearningActivityStore,
} from "./learning-activities/learning-activity-store.js";
import { createLearningActivitiesRouter } from "./learning-activities/routes.js";
import { createLogger, type Logger } from "./logging/logger.js";
import {
  disconnectedMongoHealthStatus,
  type MongoHealthStatus,
} from "./mongo/mongo-connection.js";
import { SYSTEM_DEFAULT_THEME } from "./presentation-theme/types.js";

export interface CreateAppOptions {
  didacticUnitStore: DidacticUnitStore;
  generationRunStore: GenerationRunStore;
  learningActivityStore?: LearningActivityStore;
  didacticUnitNoteStore?: DidacticUnitNoteStore;
  folderStore: FolderStore;
  aiConfigStore?: AiConfigStore;
  aiService?: AiService;
  mongoHealth?: MongoHealthStatus;
  logger?: Logger;
  authConfig: AuthConfig;
  userStore?: UserStore;
  sessionStore?: SessionStore;
  creditTransactionStore?: CreditTransactionStore;
  billingEventStore?: BillingEventStore;
  billingConfig?: BillingConfig;
  stripeClient?: StripeClientLike | null;
  testPrincipal?: AuthenticatedPrincipal;
  apiRateLimiter?: ApiRateLimiter;
  apiRateLimitPerMinute?: number;
}

export function createApp(options: CreateAppOptions) {
  const app = express();
  app.set("etag", false);
  const activeGenerationControllers = new Map<string, AbortController>();
  const didacticUnitStore = options.didacticUnitStore;
  const generationRunStore = options.generationRunStore;
  const learningActivityStore =
    options.learningActivityStore ?? new InMemoryLearningActivityStore();
  const didacticUnitNoteStore =
    options.didacticUnitNoteStore ?? new InMemoryDidacticUnitNoteStore();
  const folderStore = options.folderStore;
  const aiConfigStore = options.aiConfigStore ?? new InMemoryAiConfigStore();
  const authConfig = options.authConfig;
  const logger =
    options.logger ??
    createLogger({
      name: "didactio-backend",
    });
  const appLogger = logger.child({ component: "app" });
  const aiService = options.aiService ?? new GatewayAiService({ logger });
  const mongoHealth = options.mongoHealth ?? disconnectedMongoHealthStatus;
  const userStore = options.userStore ?? new InMemoryUserStore();
  const sessionStore = options.sessionStore ?? new InMemorySessionStore();
  const creditTransactionStore =
    options.creditTransactionStore ?? new InMemoryCreditTransactionStore();
  const billingEventStore =
    options.billingEventStore ?? new InMemoryBillingEventStore();
  const apiRateLimiter = options.apiRateLimiter ?? new InMemoryRateLimiter();
  const billingConfig = options.billingConfig ?? {
    stripeSecretKey: null,
    stripeWebhookSecret: null,
    appPublicUrl: "http://localhost:5173",
    stripePriceIds: {},
  };
  const authService = new AuthService(
    userStore,
    sessionStore,
    creditTransactionStore,
    authConfig,
    async (user) => {
      try {
        await ensureDefaultDidacticUnits({
          user,
          didacticUnitStore,
          folderStore,
          userStore,
        });
      } catch (error) {
        appLogger.error("Default didactic unit provisioning failed", {
          ownerId: user.id,
          error,
        });
      }
    },
  );
  const billingService = new BillingService(
    authService,
    userStore,
    billingEventStore,
    billingConfig,
    options.stripeClient,
  );
  const requireAuth = createRequireAuth(authConfig);
  const requireAdmin = createRequireRole("admin");
  const sleep = (milliseconds: number) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  const runModerationJob = async (
    ownerId: string,
    didacticUnitId: string,
  ): Promise<void> => {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const didacticUnit = await didacticUnitStore.getById(
        ownerId,
        didacticUnitId,
      );

      if (
        !didacticUnit ||
        (didacticUnit.status !== "submitted" &&
          didacticUnit.status !== "questionnaire_pending_moderation" &&
          didacticUnit.status !== "moderation_failed")
      ) {
        return;
      }

      try {
        const config = await aiConfigStore.get(ownerId);
        const folders = await ensureDefaultFolders(folderStore, ownerId);
        const generalFolder = folders.find(
          (folder) => folder.slug === "general",
        );

        if (!generalFolder) {
          throw new Error("General folder could not be resolved.");
        }

        const moderation = await aiService.moderateTopic({
          topic: didacticUnit.topic,
          level: didacticUnit.level,
          additionalContext: didacticUnit.additionalContext,
          folders:
            didacticUnit.folderAssignmentMode === "auto"
              ? folders.map((folder) => ({
                  name: folder.name,
                  description: buildFolderDescription(folder),
                }))
              : undefined,
          config,
          tier: "silver",
        });

        if (!moderation.approved) {
          await didacticUnitStore.save(
            rejectDidacticUnitModeration(didacticUnit, moderation.notes),
          );
          appLogger.warn("Didactic unit moderation rejected", {
            didacticUnitId,
            notes: moderation.notes,
            reasoningNotes: moderation.reasoningNotes,
          });
          return;
        }

        const moderatedDidacticUnit = moderateDidacticUnitPlanning(
          didacticUnit,
          {
            normalizedTopic: moderation.normalizedTopic,
            improvedTopicBrief: moderation.improvedTopicBrief,
            reasoningNotes: moderation.reasoningNotes,
          },
        );
        const folderUpdatedDidacticUnit =
          moderatedDidacticUnit.folderAssignmentMode === "auto"
            ? updateDidacticUnitFolder(moderatedDidacticUnit, {
                mode: "auto",
                folderId: resolveFolderIdFromModelName({
                  folderName: moderation.folderName,
                  folders,
                  fallbackFolderId: generalFolder.id,
                }),
              })
            : moderatedDidacticUnit;
        const themedDidacticUnit =
          moderation.stylePreset &&
          !folderUpdatedDidacticUnit.presentationTheme?.stylePreset
            ? {
                ...folderUpdatedDidacticUnit,
                presentationTheme: {
                  ...(folderUpdatedDidacticUnit.presentationTheme ??
                    SYSTEM_DEFAULT_THEME),
                  stylePreset: moderation.stylePreset,
                },
              }
            : folderUpdatedDidacticUnit;

        await didacticUnitStore.save(themedDidacticUnit);
        return;
      } catch (error) {
        if (attempt < maxAttempts) {
          await sleep(250 * attempt);
          continue;
        }

        const latest = await didacticUnitStore.getById(ownerId, didacticUnitId);

        if (latest) {
          await didacticUnitStore.save(
            failDidacticUnitModeration(
              latest,
              error instanceof Error
                ? resolvePublicAiFailureMessage(
                    error,
                    "Didactic unit moderation failed.",
                  )
                : "Didactic unit moderation failed.",
              attempt,
            ),
          );
        }
        appLogger.error("Didactic unit moderation job failed", {
          didacticUnitId,
          error,
        });
      }
    }
  };

  const enqueueModerationJob = (ownerId: string, didacticUnitId: string) => {
    void runModerationJob(ownerId, didacticUnitId);
  };

  configureGooglePassport(authConfig);
  if (authConfig.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (
          !origin ||
          authConfig.corsAllowedOrigins.includes(origin) ||
          (process.env.NODE_ENV !== "production" &&
            authConfig.corsAllowedOrigins.length === 0)
        ) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use((request, response, next) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    response.setHeader("X-Request-Id", requestId);

    appLogger.info("HTTP request started", {
      requestId,
      method: request.method,
      path: request.originalUrl,
    });

    response.on("finish", () => {
      appLogger.info("HTTP request completed", {
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        ownerId: request.auth?.sub,
      });
    });

    next();
  });
  app.post(
    "/api/billing/webhook",
    express.raw({ type: "application/json" }),
    createBillingWebhookHandler(billingService),
  );
  app.use(express.json({limit: "1mb", strict: true}));
  app.use(
    express.urlencoded({
      extended: true,
      limit: "100kb",
      parameterLimit: 100,
    }),
  );
  app.use(cookieParser());
  app.use(passport.initialize());

  app.locals.authService = authService;
  app.locals.authConfig = authConfig;
  app.locals.userStore = userStore;
  app.locals.sessionStore = sessionStore;
  app.locals.creditTransactionStore = creditTransactionStore;
  app.locals.billingService = billingService;
  app.locals.billingEventStore = billingEventStore;

  app.use("/auth", createAuthRouter(authConfig, authService, passport));
  app.use("/api", (request, response, next) => {
    response.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Expires", "0");
    response.removeHeader("ETag");

    if (request.path === "/health" || request.path === "/billing/pricing") {
      next();
      return;
    }

    if (!request.headers.authorization && options.testPrincipal) {
      request.auth = options.testPrincipal;
      next();
      return;
    }

    requireAuth(request, response, next);
  });
  app.use(
    "/api",
    createApiRateLimitMiddleware({
      limiter: apiRateLimiter,
      limitPerMinute: options.apiRateLimitPerMinute ?? 120,
      logger: appLogger,
      failClosed: process.env.NODE_ENV === "production",
    }),
  );
  app.use("/api/admin", requireAdmin, createAdminRouter(authService));
  app.use("/api/billing", createBillingRouter(billingService));

  const productRouteDependencies: ProductRouteDependencies = {
    didacticUnitStore,
    didacticUnitNoteStore,
    folderStore,
    generationRunStore,
    learningActivityStore,
    aiConfigStore,
    aiService,
    authService,
    appLogger,
    activeGenerationControllers,
    enqueueModerationJob,
  };

  app.use("/api", createHealthRouter(mongoHealth));
  app.use("/api", createAiRouter(productRouteDependencies));
  app.use("/api", createAnalyticsRouter(productRouteDependencies));
  app.use("/api", createFoldersRouter(productRouteDependencies));
  app.use("/api", createDidacticUnitRouter(productRouteDependencies));
  app.use("/api", createPlanningRouter(productRouteDependencies));
  app.use("/api", createChapterRouter(productRouteDependencies));
  app.use("/api", createLearningActivitiesRouter(productRouteDependencies));
  app.use("/api", createNotesRouter(productRouteDependencies));
  app.use("/api", createGenerationRunsRouter(productRouteDependencies));

  app.use(authErrorHandler);

  return app;
}
