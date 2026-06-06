export interface MoodleTokenResp {
  token?: string;
  privatetoken?: string | null;
  error?: string;
  errorcode?: string;
  stacktrace?: string | null;
}

export interface MoodleError {
  exception?: string;
  errorcode?: string;
  message?: string;
}

export interface SiteInfo {
  sitename: string;
  username: string;
  fullname: string;
  userid: number;
  release: string;
}

export interface Course {
  id: number;
  shortname: string;
  fullname: string;
  displayname?: string;
  enrolledusercount?: number;
  category?: number;
  startdate?: number;
  enddate?: number;
  progress?: number | null;
}

export interface ContentFile {
  filename: string;
  filepath: string;
  filesize: number;
  fileurl: string;
  mimetype?: string;
  timemodified?: number;
}

export interface ModuleContent extends ContentFile {
  type: string;
}

export interface Module {
  id: number;
  name: string;
  modname: string; // resource, url, assign, forum, ...
  modicon?: string;
  url?: string;
  description?: string;
  contents?: ModuleContent[];
}

export interface Section {
  id: number;
  name: string;
  section: number;
  summary?: string;
  modules: Module[];
}
