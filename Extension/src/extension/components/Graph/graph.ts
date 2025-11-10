type lineData = {
  file: string;
  line: number;
  method: string;
};

type OAlineData = {
  L: lineData;
  R: lineData;
  LC: lineData;
  RC: lineData;
  CF?: lineData;
};

type OAoptions = {
  variables?: { left: string; right: string };
};

export { type lineData };
