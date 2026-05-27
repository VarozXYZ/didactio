import type { AiConfigStore } from "../ai/config.js";
import type { AiService } from "../ai/service.js";
import type { AuthService } from "../auth/core/service.js";
import type { DidacticUnitStore } from "../didactic-unit/didactic-unit-store.js";
import type { DidacticUnitNoteStore } from "../didactic-unit/notes/note-store.js";
import type { FolderStore } from "../folders/folder-store.js";
import type { GenerationRunStore } from "../generation-runs/generation-run-store.js";
import type { LearningActivityStore } from "../learning-activities/learning-activity-store.js";
import type { Logger } from "../logging/logger.js";

export interface ProductRouteDependencies {
  didacticUnitStore: DidacticUnitStore;
  didacticUnitNoteStore: DidacticUnitNoteStore;
  folderStore: FolderStore;
  generationRunStore: GenerationRunStore;
  learningActivityStore: LearningActivityStore;
  aiConfigStore: AiConfigStore;
  aiService: AiService;
  authService: AuthService;
  appLogger: Logger;
  activeGenerationControllers: Map<string, AbortController>;
  enqueueModerationJob: (ownerId: string, didacticUnitId: string) => void;
}
