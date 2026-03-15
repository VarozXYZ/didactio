import {
    Atom,
    Binary,
    Calculator,
    FlaskConical,
    Globe,
    Microscope,
    PenLine,
    ScrollText,
    type LucideIcon,
} from 'lucide-react'

type SubjectStyle = {
    icon: LucideIcon
    bgColor: string
    iconColor: string
    accentColor: string
}

export const subjectStyles: Record<string, SubjectStyle> = {
    'Computer Science': {
        icon: Binary,
        bgColor: '#EEF2FF',
        iconColor: '#6366F1',
        accentColor: '#818CF8',
    },
    'Physics & Computer Science': {
        icon: Binary,
        bgColor: '#EEF2FF',
        iconColor: '#6366F1',
        accentColor: '#818CF8',
    },
    Mathematics: {
        icon: Calculator,
        bgColor: '#FEF3C7',
        iconColor: '#D97706',
        accentColor: '#F59E0B',
    },
    Biology: {
        icon: Microscope,
        bgColor: '#DCFCE7',
        iconColor: '#16A34A',
        accentColor: '#22C55E',
    },
    History: {
        icon: ScrollText,
        bgColor: '#FEE2E2',
        iconColor: '#DC2626',
        accentColor: '#EF4444',
    },
    Literature: {
        icon: PenLine,
        bgColor: '#F3E8FF',
        iconColor: '#9333EA',
        accentColor: '#A855F7',
    },
    Physics: {
        icon: Atom,
        bgColor: '#DBEAFE',
        iconColor: '#2563EB',
        accentColor: '#3B82F6',
    },
    Chemistry: {
        icon: FlaskConical,
        bgColor: '#FED7AA',
        iconColor: '#EA580C',
        accentColor: '#F97316',
    },
    Geography: {
        icon: Globe,
        bgColor: '#D1FAE5',
        iconColor: '#059669',
        accentColor: '#10B981',
    },
}

export function getSubjectStyle(subject: string): SubjectStyle {
    return subjectStyles[subject] || subjectStyles.Mathematics
}
