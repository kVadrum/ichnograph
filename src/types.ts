export type TreeSection = {
  root: string;
  lines: string[];
  truncated: boolean;
};

export type Report = {
  target: string;
  tree: TreeSection | null;
};
