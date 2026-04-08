import type { Workspace } from '../types';

export const sampleWorkspace: Workspace = {
  projects: [
    {
      id: 'project-test',
      name: 'Proyecto de prueba',
      lists: [
        {
          id: 'list-backlog',
          title: 'Backlog',
          cards: [
            {
              id: 'card-idea-1',
              title: 'Definir MVP',
              description: 'Listar funciones mínimas para primera demo.',
              startDate: '2026-04-10',
              endDate: '2026-04-15',
              assigneeId: 'user-alba'
            },
            {
              id: 'card-idea-2',
              title: 'Diseñar home',
              description: 'Pantalla inicial con acceso rápido a tableros.',
              assigneeId: 'user-marta'
            }
          ]
        },
        {
          id: 'list-progress',
          title: 'En curso',
          cards: [
            {
              id: 'card-dev-1',
              title: 'Setup web + desktop',
              description: 'Unificar base React con wrapper de Electron.',
              startDate: '2026-04-12',
              endDate: '2026-04-20',
              assigneeId: 'user-diego'
            }
          ]
        },
        {
          id: 'list-done',
          title: 'Completado',
          cards: [
            {
              id: 'card-done-1',
              title: 'Crear concepto visual',
              description: 'Dirección visual limpia y moderna.',
              assigneeId: 'user-nico'
            }
          ]
        }
      ]
    }
  ]
};
