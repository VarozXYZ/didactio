import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createMockAiService } from './helpers/mock-ai-service.js'
import { createTestApp } from './helpers/create-test-app.js'

async function listFolders(app: ReturnType<typeof createTestApp>) {
    const response = await request(app).get('/api/folders')
    expect(response.status).toBe(200)
    return response.body.folders as Array<{
        id: string
        name: string
        kind: 'default' | 'custom'
        unitCount: number
    }>
}

function getFolderIdByName(
    folders: Array<{ id: string; name: string }>,
    name: string
): string {
    const folder = folders.find((entry) => entry.name === name)

    if (!folder) {
        throw new Error(`Expected folder "${name}" to exist.`)
    }

    return folder.id
}

describe('folder api', () => {
    it('seeds default folders and reports unit counts', async () => {
        const app = createTestApp()

        const firstList = await listFolders(app)
        expect(firstList.map((folder) => folder.name)).toEqual([
            'General',
            'Computer Science',
            'Mathematics',
            'Biology',
            'History',
            'Literature',
            'Physics',
            'Chemistry',
            'Geography',
        ])
        expect(firstList.every((folder) => folder.unitCount === 0)).toBe(true)

        const mathFolderId = getFolderIdByName(firstList, 'Mathematics')

        const createResponse = await request(app)
            .post('/api/didactic-unit')
            .send({
                topic: 'linear algebra',
                folderSelection: {
                    mode: 'manual',
                    folderId: mathFolderId,
                },
            })

        expect(createResponse.status).toBe(201)

        const secondList = await listFolders(app)
        expect(secondList.find((folder) => folder.name === 'Mathematics')?.unitCount).toBe(1)
    })

    it('creates custom folders and rejects duplicates', async () => {
        const app = createTestApp()

        const createResponse = await request(app).post('/api/folders').send({ name: 'Languages' })
        expect(createResponse.status).toBe(201)
        expect(createResponse.body).toMatchObject({
            name: 'Languages',
            kind: 'custom',
            unitCount: 0,
        })

        const duplicateResponse = await request(app)
            .post('/api/folders')
            .send({ name: ' languages ' })

        expect(duplicateResponse.status).toBe(400)
        expect(duplicateResponse.body.error).toContain('already exists')
    })

    it('auto-assigns a folder during moderation and supports later reassignment', async () => {
        const app = createTestApp()
        const folders = await listFolders(app)

        const createResponse = await request(app)
            .post('/api/didactic-unit')
            .send({
                topic: 'chemistry fundamentals',
                folderSelection: {
                    mode: 'auto',
                },
            })

        expect(createResponse.status).toBe(201)
        expect(createResponse.body).toMatchObject({
            folderAssignmentMode: 'auto',
            folder: {
                name: 'General',
            },
        })

        const moderateResponse = await request(app)
            .post(`/api/didactic-unit/${createResponse.body.id}/moderate`)
            .send({})

        expect(moderateResponse.status).toBe(200)
        expect(moderateResponse.body.folder).toMatchObject({
            name: 'Chemistry',
        })

        const historyFolderId = getFolderIdByName(folders, 'History')
        const manualUpdateResponse = await request(app)
            .patch(`/api/didactic-unit/${createResponse.body.id}/folder`)
            .send({
                folderSelection: {
                    mode: 'manual',
                    folderId: historyFolderId,
                },
            })

        expect(manualUpdateResponse.status).toBe(200)
        expect(manualUpdateResponse.body).toMatchObject({
            folderAssignmentMode: 'manual',
            folder: {
                name: 'History',
            },
        })

        const autoUpdateResponse = await request(app)
            .patch(`/api/didactic-unit/${createResponse.body.id}/folder`)
            .send({
                folderSelection: {
                    mode: 'auto',
                },
            })

        expect(autoUpdateResponse.status).toBe(200)
        expect(autoUpdateResponse.body).toMatchObject({
            folderAssignmentMode: 'auto',
            folder: {
                name: 'Chemistry',
            },
        })
    })

    it('falls back to General when moderation returns an unknown folder name', async () => {
        const aiService = createMockAiService()
        aiService.moderateTopic = async (input) => ({
            provider: 'mock-provider',
            model: 'mock-model',
            prompt: `Moderate ${input.topic}`,
            approved: true,
            notes: 'Approved.',
            normalizedTopic: input.topic.trim(),
            improvedTopicBrief: `Create a practical didactic unit about ${input.topic.trim()}.`,
            reasoningNotes: 'Topic is safe.',
            folderName: 'Definitely Not A Real Folder',
            folderReasoning: 'Hallucinated folder name for test coverage.',
        })

        const app = createTestApp({ aiService })

        const createResponse = await request(app)
            .post('/api/didactic-unit')
            .send({
                topic: 'interdisciplinary capstone',
                folderSelection: {
                    mode: 'auto',
                },
            })

        expect(createResponse.status).toBe(201)

        const moderateResponse = await request(app)
            .post(`/api/didactic-unit/${createResponse.body.id}/moderate`)
            .send({})

        expect(moderateResponse.status).toBe(200)
        expect(moderateResponse.body).toMatchObject({
            folderAssignmentMode: 'auto',
            folder: {
                name: 'General',
            },
        })
    })
})
