import {createHash} from "node:crypto";
import type {AuthUser, UserStore} from "../auth/core/types.js";
import {ensureDefaultFolders} from "../folders/folder-defaults.js";
import type {FolderStore} from "../folders/folder-store.js";
import type {DidacticUnit} from "./create-didactic-unit.js";
import type {DidacticUnitStore} from "./didactic-unit-store.js";
import pythonIntroductionTemplate from "./default-templates/e6aa29be-3371-42ce-a33e-4f31fd4207a2.json" with {type: "json"};

export interface DefaultDidacticUnitDefinition {
	id: string;
	template: DefaultDidacticUnitTemplate;
	folderSlug: string;
}

type DefaultDidacticUnitTemplate = Omit<
	DidacticUnit,
	| "ownerId"
	| "folderId"
	| "createdAt"
	| "updatedAt"
	| "moduleReadProgress"
	| "completedChapters"
	| "unitGenerationPaidAt"
	| "unitGenerationCreditTransactionId"
>;

export const DEFAULT_DIDACTIC_UNIT_DEFINITIONS: DefaultDidacticUnitDefinition[] = [
	{
		id: "welcome-unit-e6aa29be",
		template: pythonIntroductionTemplate as unknown as DefaultDidacticUnitTemplate,
		folderSlug: "computer-science",
	},
];

interface EnsureDefaultDidacticUnitsInput {
	user: AuthUser;
	didacticUnitStore: DidacticUnitStore;
	folderStore: FolderStore;
	userStore: UserStore;
}

const provisioningInFlight = new Map<string, Promise<void>>();

function createCloneId(ownerId: string, templateId: string): string {
	const hash = createHash("sha256")
		.update(`${ownerId}:${templateId}`)
		.digest("hex");
	return [
		hash.slice(0, 8),
		hash.slice(8, 12),
		hash.slice(12, 16),
		hash.slice(16, 20),
		hash.slice(20, 32),
	].join("-");
}

function createDefaultUnitClone(input: {
	template: DefaultDidacticUnitTemplate;
	ownerId: string;
	folderId: string;
	templateId: string;
}): DidacticUnit {
	const template = structuredClone(input.template);
	const createdAt = new Date().toISOString();

	return {
		...template,
		id: createCloneId(input.ownerId, input.templateId),
		ownerId: input.ownerId,
		folderId: input.folderId,
		folderAssignmentMode: "manual",
		defaultTemplateId: input.templateId,
		defaultTemplateSourceId: input.template.id,
		createdAt,
		updatedAt: createdAt,
	};
}

async function ensureDefaultDidacticUnitsOnce(
	input: EnsureDefaultDidacticUnitsInput,
): Promise<void> {
	const completedTemplateIds = new Set(
		input.user.defaultDidacticUnitTemplateIds ?? [],
	);
	const ownedUnits = await input.didacticUnitStore.listByOwner(input.user.id);
	const folders = await ensureDefaultFolders(input.folderStore, input.user.id);

	for (const definition of DEFAULT_DIDACTIC_UNIT_DEFINITIONS) {
		if (completedTemplateIds.has(definition.id)) {
			continue;
		}

		const existingClone = ownedUnits.find(
			(unit) => unit.defaultTemplateId === definition.id,
		);
		if (!existingClone) {
			const folder = folders.find(
				(candidate) => candidate.slug === definition.folderSlug,
			);
			if (!folder) {
				throw new Error(
					`Default didactic unit folder "${definition.folderSlug}" could not be resolved.`,
				);
			}

			await input.didacticUnitStore.save(
				createDefaultUnitClone({
					template: definition.template,
					ownerId: input.user.id,
					folderId: folder.id,
					templateId: definition.id,
				}),
			);
		}

		await input.userStore.markDefaultDidacticUnitTemplateProvisioned(
			input.user.id,
			definition.id,
			new Date(),
		);
		completedTemplateIds.add(definition.id);
	}
}

export async function ensureDefaultDidacticUnits(
	input: EnsureDefaultDidacticUnitsInput,
): Promise<void> {
	const activeProvisioning = provisioningInFlight.get(input.user.id);
	if (activeProvisioning) {
		return activeProvisioning;
	}

	let provisioning: Promise<void>;
	provisioning = ensureDefaultDidacticUnitsOnce(input).finally(() => {
		if (provisioningInFlight.get(input.user.id) === provisioning) {
			provisioningInFlight.delete(input.user.id);
		}
	});
	provisioningInFlight.set(input.user.id, provisioning);
	return provisioning;
}
