import { didacticUnit } from './didacticUnit'
import type { DashboardFolder, DetailedUnit, UnitSummary } from '../types'

export const EDITABLE_UNIT_ID = didacticUnit.listingId

export const mockFolders: DashboardFolder[] = [
    {
        id: 1,
        name: 'Math Units',
        icon: '\uD83D\uDCD0',
        color: '#4ADE80',
        unitCount: 2,
        units: [2, 6],
    },
    {
        id: 2,
        name: 'Science Curriculum',
        icon: '\uD83D\uDD2C',
        color: '#3B82F6',
        unitCount: 2,
        units: [1, 3],
    },
    {
        id: 3,
        name: 'History Lessons',
        icon: '\uD83D\uDCDC',
        color: '#F59E0B',
        unitCount: 2,
        units: [4, 5],
    },
]

const editableUnitSummary: UnitSummary = {
    id: EDITABLE_UNIT_ID,
    editorUnitId: didacticUnit.id,
    canOpenEditor: true,
    title: didacticUnit.title,
    subject: didacticUnit.subject,
    chapters: didacticUnit.chapters.length,
    progress: didacticUnit.progress,
    lastModified: didacticUnit.lastEdited,
    status: didacticUnit.status,
    level: didacticUnit.level,
    readingTime: didacticUnit.readingTime,
    coverColor: didacticUnit.coverColor,
}

export const mockUnits: UnitSummary[] = [
    editableUnitSummary,
    {
        id: 2,
        title: 'Introduction to Calculus',
        subject: 'Mathematics',
        chapters: 12,
        progress: 30,
        lastModified: '1 day ago',
        status: 'ready',
        level: 'Intermediate',
        readingTime: '60 min',
        coverColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
        id: 3,
        title: 'Cell Biology Basics',
        subject: 'Biology',
        chapters: 6,
        progress: 100,
        lastModified: '3 days ago',
        status: 'ready',
        level: 'Beginner',
        readingTime: '30 min',
        coverColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
        id: 4,
        title: 'World War II Analysis',
        subject: 'History',
        chapters: 10,
        progress: 0,
        lastModified: '1 week ago',
        status: 'generating',
        level: 'Advanced',
        readingTime: '50 min',
        coverColor: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    },
    {
        id: 5,
        title: "Shakespeare's Tragedies",
        subject: 'Literature',
        chapters: 5,
        progress: 45,
        lastModified: '2 days ago',
        status: 'ready',
        level: 'Advanced',
        readingTime: '40 min',
        coverColor: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    },
    {
        id: 6,
        title: 'Linear Algebra Essentials',
        subject: 'Mathematics',
        chapters: 9,
        progress: 80,
        lastModified: '5 hours ago',
        status: 'ready',
        level: 'Intermediate',
        readingTime: '55 min',
        coverColor: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    },
]

export function isUnitEditable(unitId: number): boolean {
    return unitId === EDITABLE_UNIT_ID
}

export function getDetailedUnitById(unitId: number | null): DetailedUnit | null {
    if (!unitId || !isUnitEditable(unitId)) {
        return null
    }

    return didacticUnit
}
