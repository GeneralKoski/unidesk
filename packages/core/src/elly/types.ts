export interface Course {
  id: number;
  shortname: string;
  fullname: string;
  viewurl?: string;
  courseimage?: string;
  progress?: number | null;
  hidden?: boolean;
}

export interface Module {
  id: number;
  name: string;
  modname: string; // resource, url, folder, forum, assign, ...
  url?: string;
  filename?: string; // nome file reale con estensione (moduli "resource")
  mimetype?: string; // mime type del file (moduli "resource")
}

export interface Section {
  id: number;
  name: string;
  section: number;
  modules: Module[];
}
