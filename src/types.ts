export type Card = {
  id: string;
  title: string;
  description: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  assigneeId?: string;
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
};

export type Workspace = {
  projects: Project[];
};
