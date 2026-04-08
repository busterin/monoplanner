import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fakeUsers } from './data/fakeUsers';
import { loadWorkspace, saveWorkspace } from './lib/storage';
import type { Card, List, Project, User, Workspace } from './types';

const LIST_PREFIX = 'list:';
const CARD_PREFIX = 'card:';

function listDragId(listId: string) {
  return `${LIST_PREFIX}${listId}`;
}

function cardDragId(listId: string, cardId: string) {
  return `${CARD_PREFIX}${listId}:${cardId}`;
}

function parseCardDragId(value: string) {
  const stripped = value.replace(CARD_PREFIX, '');
  const [listId, cardId] = stripped.split(':');
  return { listId, cardId };
}

function getListIdFromDropTarget(targetId: string) {
  if (targetId.startsWith(LIST_PREFIX)) {
    return targetId.replace(LIST_PREFIX, '');
  }

  if (targetId.startsWith(CARD_PREFIX)) {
    return parseCardDragId(targetId).listId;
  }

  return null;
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value?: string) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

type ProjectView = 'board' | 'calendar';

type CalendarEvent = {
  listId: string;
  cardId: string;
  title: string;
  listTitle: string;
  start: string;
  end: string;
};

function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => loadWorkspace());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ type: 'list' | 'card'; title: string } | null>(null);
  const [editingCardRef, setEditingCardRef] = useState<{ listId: string; cardId: string } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  const [showMobileProjectsPage, setShowMobileProjectsPage] = useState(() => window.innerWidth <= 900);
  const [activeView, setActiveView] = useState<ProjectView>('board');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [isBoardPanning, setIsBoardPanning] = useState(false);
  const panSessionRef = useRef<{
    active: boolean;
    startX: number;
    startScrollLeft: number;
  }>({
    active: false,
    startX: 0,
    startScrollLeft: 0
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeProject = useMemo(
    () => workspace.projects.find((project) => project.id === activeProjectId) ?? null,
    [workspace.projects, activeProjectId]
  );

  const listIds = useMemo(() => activeProject?.lists.map((list) => listDragId(list.id)) ?? [], [activeProject]);
  const usersById = useMemo(() => Object.fromEntries(fakeUsers.map((user) => [user.id, user])), []);

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    if (!activeProject) return [];

    return activeProject.lists.flatMap((list) =>
      list.cards
        .map((card) => {
          const start = card.startDate ?? card.endDate ?? card.dueDate;
          const end = card.endDate ?? card.startDate ?? card.dueDate;
          if (!start || !end) return null;

          return {
            listId: list.id,
            cardId: card.id,
            title: card.title,
            listTitle: list.title,
            start,
            end
          };
        })
        .filter((item): item is CalendarEvent => item !== null)
    );
  }, [activeProject]);

  const editingCard = useMemo(() => {
    if (!editingCardRef || !activeProject) return null;

    const list = activeProject.lists.find((item) => item.id === editingCardRef.listId);
    if (!list) return null;

    const card = list.cards.find((item) => item.id === editingCardRef.cardId);
    return card ? { listId: list.id, card } : null;
  }, [activeProject, editingCardRef]);

  useEffect(() => {
    if (!activeProjectId && workspace.projects.length > 0) {
      setActiveProjectId(workspace.projects[0].id);
      return;
    }

    if (activeProjectId && !workspace.projects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(workspace.projects[0]?.id ?? null);
    }
  }, [workspace.projects, activeProjectId]);

  useEffect(() => {
    setEditingCardRef(null);
    setActiveView('board');
  }, [activeProjectId]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');

    const sync = () => {
      const mobile = media.matches;
      setIsMobile(mobile);

      if (mobile) {
        setShowMobileProjectsPage(true);
      } else {
        setShowMobileProjectsPage(false);
      }
    };

    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const commitWorkspace = (nextWorkspace: Workspace) => {
    setWorkspace(nextWorkspace);
    saveWorkspace(nextWorkspace);
  };

  const updateActiveProject = (updater: (project: Project) => Project) => {
    if (!activeProject) return;

    const nextWorkspace: Workspace = {
      projects: workspace.projects.map((project) =>
        project.id === activeProject.id ? updater(project) : project
      )
    };

    commitWorkspace(nextWorkspace);
  };

  const addProject = () => {
    const name = window.prompt('Nombre del proyecto');
    if (!name?.trim()) return;

    const nextProject: Project = {
      id: newId('project'),
      name: name.trim(),
      lists: []
    };

    const nextWorkspace: Workspace = {
      projects: [...workspace.projects, nextProject]
    };

    commitWorkspace(nextWorkspace);
    setActiveProjectId(nextProject.id);
    if (isMobile) {
      setShowMobileProjectsPage(false);
    }
  };

  const addList = () => {
    if (!activeProject) return;

    const title = window.prompt('Nombre de la lista');
    if (!title?.trim()) return;

    updateActiveProject((project) => ({
      ...project,
      lists: [...project.lists, { id: newId('list'), title: title.trim(), cards: [] }]
    }));
  };

  const addCard = (listId: string) => {
    if (!activeProject) return;

    const title = window.prompt('Título de la tarjeta');
    if (!title?.trim()) return;

    const description = window.prompt('Descripción (opcional)') ?? '';

    updateActiveProject((project) => ({
      ...project,
      lists: project.lists.map((list) =>
        list.id === listId
          ? {
              ...list,
              cards: [...list.cards, { id: newId('card'), title: title.trim(), description: description.trim() }]
            }
          : list
      )
    }));
  };

  const updateCard = (
    listId: string,
    cardId: string,
    nextValues: Pick<Card, 'title' | 'description' | 'startDate' | 'endDate' | 'assigneeId' | 'color'>
  ) => {
    updateActiveProject((project) => ({
      ...project,
      lists: project.lists.map((list) =>
        list.id !== listId
          ? list
          : {
              ...list,
              cards: list.cards.map((card) =>
                card.id !== cardId
                  ? card
                  : {
                      ...card,
                      ...nextValues
                    }
              )
            }
      )
    }));
  };

  const onDragStart = (event: DragStartEvent) => {
    if (!activeProject || activeView !== 'board') return;

    const id = String(event.active.id);

    if (id.startsWith(LIST_PREFIX)) {
      const listId = id.replace(LIST_PREFIX, '');
      const list = activeProject.lists.find((item) => item.id === listId);
      setActiveDrag(list ? { type: 'list', title: list.title } : null);
      return;
    }

    if (id.startsWith(CARD_PREFIX)) {
      const { listId, cardId } = parseCardDragId(id);
      const list = activeProject.lists.find((item) => item.id === listId);
      const card = list?.cards.find((item) => item.id === cardId);
      setActiveDrag(card ? { type: 'card', title: card.title } : null);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (!activeProject || activeView !== 'board') {
      setActiveDrag(null);
      return;
    }

    setActiveDrag(null);

    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    if (activeId.startsWith(LIST_PREFIX)) {
      const activeListId = activeId.replace(LIST_PREFIX, '');
      const overListId = getListIdFromDropTarget(overId);
      if (!overListId) return;

      const oldIndex = activeProject.lists.findIndex((list) => list.id === activeListId);
      const newIndex = activeProject.lists.findIndex((list) => list.id === overListId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      updateActiveProject((project) => ({
        ...project,
        lists: arrayMove(project.lists, oldIndex, newIndex)
      }));
      return;
    }

    if (!activeId.startsWith(CARD_PREFIX)) return;

    const activeCardMeta = parseCardDragId(activeId);
    const sourceListIndex = activeProject.lists.findIndex((list) => list.id === activeCardMeta.listId);
    if (sourceListIndex === -1) return;

    const sourceList = activeProject.lists[sourceListIndex];
    const sourceCardIndex = sourceList.cards.findIndex((card) => card.id === activeCardMeta.cardId);
    if (sourceCardIndex === -1) return;

    const sourceCard = sourceList.cards[sourceCardIndex];

    let destinationListId = '';
    let destinationCardId: string | null = null;

    if (overId.startsWith(CARD_PREFIX)) {
      const overMeta = parseCardDragId(overId);
      destinationListId = overMeta.listId;
      destinationCardId = overMeta.cardId;
    } else if (overId.startsWith(LIST_PREFIX)) {
      destinationListId = overId.replace(LIST_PREFIX, '');
    }

    if (!destinationListId) return;

    const destinationListIndex = activeProject.lists.findIndex((list) => list.id === destinationListId);
    if (destinationListIndex === -1) return;

    const nextLists = activeProject.lists.map((list) => ({ ...list, cards: [...list.cards] }));

    nextLists[sourceListIndex].cards.splice(sourceCardIndex, 1);

    const insertIndex =
      destinationCardId === null
        ? nextLists[destinationListIndex].cards.length
        : nextLists[destinationListIndex].cards.findIndex((card) => card.id === destinationCardId);

    const safeIndex = insertIndex < 0 ? nextLists[destinationListIndex].cards.length : insertIndex;
    nextLists[destinationListIndex].cards.splice(safeIndex, 0, sourceCard);

    updateActiveProject((project) => ({
      ...project,
      lists: nextLists
    }));
  };

  const isPanIgnoredTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    return Boolean(
      target.closest('.task-card, .list-header, button, input, textarea, select, a, [role="button"]')
    );
  };

  const onBoardPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (isPanIgnoredTarget(event.target)) return;

    const container = event.currentTarget;
    panSessionRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft
    };
    setIsBoardPanning(true);
    container.setPointerCapture(event.pointerId);
  };

  const onBoardPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!panSessionRef.current.active) return;
    const container = event.currentTarget;
    const delta = event.clientX - panSessionRef.current.startX;
    container.scrollLeft = panSessionRef.current.startScrollLeft - delta;
    event.preventDefault();
  };

  const finishBoardPan = () => {
    if (!panSessionRef.current.active) return;
    panSessionRef.current.active = false;
    setIsBoardPanning(false);
  };

  const selectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    if (isMobile) {
      setShowMobileProjectsPage(false);
    }
  };

  if (isMobile && showMobileProjectsPage) {
    return (
      <main className="mobile-projects-page">
        <header className="mobile-projects-header">
          <p className="eyebrow">Mono Planner</p>
          <h1>Proyectos</h1>
        </header>

        <div className="mobile-projects-list">
          {workspace.projects.map((project) => (
            <button
              key={project.id}
              className={`project-item ${project.id === activeProjectId ? 'active' : ''}`}
              onClick={() => selectProject(project.id)}
            >
              {project.name}
            </button>
          ))}
        </div>

        <footer className="mobile-projects-actions">
          <button className="btn btn-primary" onClick={addProject}>
            + Nuevo proyecto
          </button>
        </footer>
      </main>
    );
  }

  return (
    <main className={`app-shell ${isSidebarCollapsed ? 'sidebar-hidden' : ''}`}>
      {!isMobile && !isSidebarCollapsed ? (
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Proyectos</h2>
            <button className="btn btn-subtle" onClick={addProject}>
              +
            </button>
          </div>

          <div className="project-list">
            {workspace.projects.map((project) => (
              <button
                key={project.id}
                className={`project-item ${project.id === activeProjectId ? 'active' : ''}`}
                onClick={() => selectProject(project.id)}
              >
                {project.name}
              </button>
            ))}
          </div>

          <div className="sidebar-footer">
            <button className="btn btn-subtle sidebar-toggle-full" onClick={() => setIsSidebarCollapsed(true)}>
              Ocultar proyectos
            </button>
          </div>
        </aside>
      ) : null}

      <section className="main-area">
        <div className="page-head">
          {isMobile ? (
            <button className="btn btn-subtle mobile-menu-close" onClick={() => setShowMobileProjectsPage(true)}>
              X
            </button>
          ) : null}

          <div className="page-title">
            <p className="eyebrow">Mono Planner</p>
            <h1>{activeProject?.name ?? 'Sin proyecto'}</h1>
          </div>

          {!isMobile && isSidebarCollapsed ? (
            <button className="btn btn-subtle sidebar-reopen" onClick={() => setIsSidebarCollapsed(false)}>
              Mostrar proyectos
            </button>
          ) : null}
        </div>

        {activeProject ? (
          <>
            <nav className="project-nav" aria-label="Secciones del proyecto">
              <button
                className={`project-nav-item ${activeView === 'board' ? 'active' : ''}`}
                onClick={() => setActiveView('board')}
              >
                Tablero
              </button>
              <button
                className={`project-nav-item ${activeView === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveView('calendar')}
              >
                Calendario
              </button>
            </nav>

            <div className="project-content">
              {activeView === 'board' ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                >
                  <section
                    className={`board-lists ${isBoardPanning ? 'is-panning' : ''}`}
                    onPointerDown={onBoardPointerDown}
                    onPointerMove={onBoardPointerMove}
                    onPointerUp={finishBoardPan}
                    onPointerCancel={finishBoardPan}
                  >
                    <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
                      {activeProject.lists.map((list) => (
                        <SortableList
                          key={list.id}
                          list={list}
                          onAddCard={addCard}
                          onOpenCard={(cardId) => setEditingCardRef({ listId: list.id, cardId })}
                          usersById={usersById}
                        />
                      ))}
                    </SortableContext>

                    <article className="list-add-column">
                      <button className="btn btn-primary add-list-button" onClick={addList}>
                        + Nueva lista
                      </button>
                    </article>
                  </section>

                  <DragOverlay>
                    {activeDrag ? (
                      <div className={`overlay-card ${activeDrag.type === 'list' ? 'overlay-list' : ''}`}>{activeDrag.title}</div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              ) : (
                <ProjectCalendar
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  events={calendarEvents}
                  onOpenCard={(listId, cardId) => setEditingCardRef({ listId, cardId })}
                />
              )}
            </div>
          </>
        ) : (
          <section className="empty-state">
            <p>No hay proyectos aún.</p>
            <button className="btn btn-primary" onClick={addProject}>
              Crear primer proyecto
            </button>
          </section>
        )}
      </section>

      {editingCard ? (
        <CardEditModal
          card={editingCard.card}
          users={fakeUsers}
          onClose={() => setEditingCardRef(null)}
          onSave={(values) => {
            updateCard(editingCard.listId, editingCard.card.id, values);
            setEditingCardRef(null);
          }}
        />
      ) : null}
    </main>
  );
}

type SortableListProps = {
  list: List;
  onAddCard: (listId: string) => void;
  onOpenCard: (cardId: string) => void;
  usersById: Record<string, User>;
};

function SortableList({ list, onAddCard, onOpenCard, usersById }: SortableListProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listDragId(list.id)
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  };

  const cardIds = list.cards.map((card) => cardDragId(list.id, card.id));

  return (
    <article ref={setNodeRef} style={style} className="list-column">
      <header className="list-header" {...attributes} {...listeners}>
        <h2>{list.title}</h2>
        <span>{list.cards.length}</span>
      </header>

      <div className="cards-stack" id={list.id}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {list.cards.map((card) => {
            const assignee = card.assigneeId ? usersById[card.assigneeId] : undefined;
            const assigneeLabel = assignee ? `${assignee.emoji} ${assignee.name}` : '';

            return (
            <SortableCard
              key={card.id}
              card={card}
              listId={list.id}
              onOpen={() => onOpenCard(card.id)}
              assigneeName={assigneeLabel}
              color={card.color}
            />
            );
          })}
        </SortableContext>
      </div>

      <button className="btn btn-subtle" onClick={() => onAddCard(list.id)}>
        + Añadir tarjeta
      </button>
    </article>
  );
}

type SortableCardProps = {
  card: Card;
  listId: string;
  onOpen: () => void;
  assigneeName: string;
  color?: string;
};

function SortableCard({ card, listId, onOpen, assigneeName, color }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardDragId(listId, card.id)
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: color ?? '#ffffff'
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="task-card"
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
          onOpen();
        }
      }}
    >
      <h3>{card.title}</h3>
      {card.description ? <p>{card.description}</p> : null}

      {card.startDate || card.endDate || assigneeName ? (
        <div className="card-meta">
          {card.startDate ? <span className="meta-chip">Inicio: {formatDate(card.startDate)}</span> : null}
          {card.endDate ? <span className="meta-chip">Fin: {formatDate(card.endDate)}</span> : null}
          {assigneeName ? <span className="meta-chip">{assigneeName}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

type ProjectCalendarProps = {
  month: Date;
  onMonthChange: (nextMonth: Date) => void;
  events: CalendarEvent[];
  onOpenCard: (listId: string, cardId: string) => void;
};

function ProjectCalendar({ month, onMonthChange, events, onOpenCard }: ProjectCalendarProps) {
  const monthStart = startOfMonth(month);
  const dayIndex = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - dayIndex);

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <section className="calendar-shell">
      <header className="calendar-header">
        <h2>
          {monthStart.toLocaleDateString('es-ES', {
            month: 'long',
            year: 'numeric'
          })}
        </h2>

        <div className="calendar-controls">
          <button
            className="btn btn-subtle"
            onClick={() => onMonthChange(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
          >
            Anterior
          </button>
          <button className="btn btn-subtle" onClick={() => onMonthChange(startOfMonth(new Date()))}>
            Hoy
          </button>
          <button
            className="btn btn-subtle"
            onClick={() => onMonthChange(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
          >
            Siguiente
          </button>
        </div>
      </header>

      <div className="calendar-grid">
        {weekDays.map((day) => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dayIso = formatIsoDate(day);
          const items = events.filter((event) => event.start <= dayIso && dayIso <= event.end);
          const isCurrentMonth = day.getMonth() === monthStart.getMonth();

          return (
            <article key={dayIso} className={`calendar-day ${isCurrentMonth ? '' : 'outside'}`}>
              <header className="calendar-day-head">{day.getDate()}</header>
              <div className="calendar-events">
                {items.map((event) => (
                  <button
                    key={`${event.cardId}-${dayIso}`}
                    className="calendar-event"
                    onClick={() => onOpenCard(event.listId, event.cardId)}
                    title={`${event.title} • ${event.listTitle}`}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type CardEditModalProps = {
  card: Card;
  users: User[];
  onSave: (values: Pick<Card, 'title' | 'description' | 'startDate' | 'endDate' | 'assigneeId' | 'color'>) => void;
  onClose: () => void;
};

function CardEditModal({ card, users, onSave, onClose }: CardEditModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [startDate, setStartDate] = useState(card.startDate ?? '');
  const [endDate, setEndDate] = useState(card.endDate ?? card.dueDate ?? '');
  const [assigneeId, setAssigneeId] = useState(card.assigneeId ?? '');
  const [color, setColor] = useState(card.color ?? '#ffffff');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim()) {
      window.alert('El título no puede estar vacío.');
      return;
    }

    if (startDate && endDate && startDate > endDate) {
      window.alert('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    onSave({
      title: title.trim(),
      description: description.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      assigneeId: assigneeId || undefined,
      color: color || '#ffffff'
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="card-modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="card-modal-header">
          <h2>Editar tarjeta</h2>
        </header>

        <form className="card-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Título</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          <label className="field">
            <span>Descripción</span>
            <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>

          <label className="field">
            <span>Fecha de inicio</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>

          <label className="field">
            <span>Fecha de fin</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>

          <label className="field">
            <span>Asignado a</span>
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Sin asignar</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.emoji} {user.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Color de tarjeta</span>
            <div className="color-field">
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              <span className="color-value">{color}</span>
            </div>
          </label>

          <footer className="card-modal-actions">
            <button type="button" className="btn btn-subtle" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default App;
