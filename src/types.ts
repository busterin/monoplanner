export type Card = {
  id: string;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  assigneeId?: string;
  color?: string;
};

export type List = {
  id: string;
  title: string;
  cards: Card[];
};

export type Project = {
  id: string;
  name: string;
  lists: List[];
};

export type User = {
  id: string;
  name: string;
  emoji: string;
  avatarUrl?: string;
};

export type Workspace = {
  projects: Project[];
};
