import type { DidacticUnit } from './create-didactic-unit.js'
import {
    getModuleTotalCharacterCount,
    updateDidacticUnitModuleReadProgress,
} from './module-reading-progress.js'

export function completeDidacticUnitChapter(
    didacticUnit: DidacticUnit,
    chapterIndex: number
): DidacticUnit {
    const totalCharacterCount = getModuleTotalCharacterCount(didacticUnit, chapterIndex)

    if (totalCharacterCount === 0) {
        throw new Error('Generated didactic unit module not found.')
    }

    return updateDidacticUnitModuleReadProgress(
        didacticUnit,
        chapterIndex,
        totalCharacterCount
    )
}
