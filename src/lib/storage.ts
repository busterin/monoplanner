import { sampleWorkspace } from '../data/sampleData';
import type { Card, List, Project, Workspace } from '../types';

const STORAGE_KEY = 'mono_planner_board';

export function loadWorkspace(): Workspace {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return sampleWorkspace;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeWorkspace(parsed);
  } catch {
    return sampleWorkspace;
  }
}

export function saveWorkspace(workspace: Workspace) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function normalizeCard(card: Card): Card {
  if (card.endDate || !card.dueDate) {
    return card;
  }

  return {
    ...card,
    endDate: card.dueDate
  };
}

function normalizeWorkspace(payload: Record<string, unknown>): Workspace {
  if (Array.isArray(payload.projects)) {
    const projects = payload.projects as Project[];
    return {
      projects: projects.map((project) => ({
        ...project,
        lists: project.lists.map((list) => ({
          ...list,
          cards: list.cards.map(normalizeCard)
        }))
      }))
    };
  }

  if (Array.isArray(payload.lists)) {
    const legacyLists = payload.lists as List[];
    return {
      projects: [
        {
          id: 'project-test',
          name: 'Proyecto de prueba',
          lists: legacyLists.map((list) => ({
            ...list,
            cards: list.cards.map(normalizeCard)
          }))
        }
      ]
    };
  }

  return sampleWorkspace;
}
