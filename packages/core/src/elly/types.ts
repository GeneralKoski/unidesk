export interface Course {
  id: number;
  // Istanza Elly da cui arriva il corso. Gli id sono per-istanza, quindi due
  // corsi di anni diversi possono avere lo stesso id: serve per non confonderli
  // e per sapere a chi rivolgersi per contenuti e file.
  base: string;
  // Anno accademico dell'istanza, ricavato dalla base. Solo per mostrarlo.
  year?: number;
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
