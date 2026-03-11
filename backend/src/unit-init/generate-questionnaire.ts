import type { CreatedUnitInit } from './create-unit-init.js'

export type UnitInitQuestionType = 'single_select' | 'long_text'

export interface UnitInitQuestionOption {
    value: string
    label: string
}

export interface UnitInitQuestion {
    id: string
    prompt: string
    type: UnitInitQuestionType
    options?: UnitInitQuestionOption[]
}

export interface UnitInitQuestionnaire {
    questions: UnitInitQuestion[]
}

function buildLevelOptions(): UnitInitQuestionOption[] {
    return [
        { value: 'none', label: 'No prior knowledge' },
        { value: 'basic', label: 'Basic understanding' },
        { value: 'intermediate', label: 'Intermediate experience' },
        { value: 'advanced', label: 'Advanced experience' },
    ]
}

function buildDepthOptions(): UnitInitQuestionOption[] {
    return [
        { value: 'basic', label: 'Keep it basic' },
        { value: 'balanced', label: 'Balanced depth' },
        { value: 'advanced', label: 'Go advanced' },
    ]
}

function buildLengthOptions(): UnitInitQuestionOption[] {
    return [
        { value: 'short', label: 'Short unit' },
        { value: 'medium', label: 'Medium unit' },
        { value: 'long', label: 'Long unit' },
    ]
}

export function buildQuestionnaireForUnitInit(topic: string): UnitInitQuestionnaire {
    return {
        questions: [
            {
                id: 'topic_knowledge_level',
                prompt: `What is your current knowledge level in ${topic}?`,
                type: 'single_select',
                options: buildLevelOptions(),
            },
            {
                id: 'related_knowledge_level',
                prompt: `How comfortable are you with related concepts that may support learning ${topic}?`,
                type: 'single_select',
                options: buildLevelOptions(),
            },
            {
                id: 'learning_goal',
                prompt: `What do you want to achieve by learning ${topic}?`,
                type: 'long_text',
            },
            {
                id: 'preferred_depth',
                prompt: `How advanced should the didactic unit for ${topic} be?`,
                type: 'single_select',
                options: buildDepthOptions(),
            },
            {
                id: 'preferred_length',
                prompt: `How long should the didactic unit for ${topic} be?`,
                type: 'single_select',
                options: buildLengthOptions(),
            },
        ],
    }
}

export function generateQuestionnaire(unitInit: CreatedUnitInit): CreatedUnitInit {
    if (unitInit.status !== 'moderation_completed') {
        throw new Error('Questionnaire cannot be generated from the current unit-init state.')
    }

    return {
        ...unitInit,
        status: 'questionnaire_ready',
        nextAction: 'answer_questionnaire',
        questionnaire: buildQuestionnaireForUnitInit(unitInit.topic),
        questionnaireGeneratedAt: new Date().toISOString(),
    }
}
