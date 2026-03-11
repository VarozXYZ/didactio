import type { CreatedUnitInit } from './create-unit-init.js'

export function approveSyllabus(unitInit: CreatedUnitInit): CreatedUnitInit {
    if (unitInit.status !== 'syllabus_ready' || !unitInit.syllabus) {
        throw new Error('Syllabus cannot be approved from the current unit-init state.')
    }

    return {
        ...unitInit,
        status: 'syllabus_approved',
        nextAction: 'generate_unit_content',
        syllabusApprovedAt: new Date().toISOString(),
    }
}
