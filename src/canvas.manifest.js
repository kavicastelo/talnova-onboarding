export const manifest = {
  screens: {
    scr_oc2xo6: { name: "Admin Dashboard", route: "/", position: { "x": 0, "y": 0 }, isDefaultRow: true },
    scr_xvlmb9: { name: "Onboarding Journeys", route: "/journeys", position: { "x": 160, "y": 1820 } },
    scr_bp4w6l: { name: "Journey Builder", route: "/journeys/1", position: { "x": 1560, "y": 1820 } },
    scr_txrzaw: { name: "Employees", route: "/directory", position: { "x": 160, "y": 3800 } },
    scr_7rl6de: { name: "Employee Profile", route: "/directory/1", position: { "x": 1560, "y": 3800 } },
    scr_eio01k: { name: "Analytics", route: "/analytics", position: { "x": 1400, "y": 0 }, isDefaultRow: true },
    scr_zd77ci: { name: "Knowledge Base", route: "/kb", position: { "x": 2800, "y": 0 }, isDefaultRow: true },
    scr_ge8zwt: { name: "Settings", route: "/settings", position: { "x": 4200, "y": 0 }, isDefaultRow: true },
    scr_geocps: { name: "Employee Dashboard", route: "/employee", position: { "x": 5600, "y": 0 }, isDefaultRow: true },
    scr_zwclkf: { name: "Course Viewer", route: "/course/1", position: { "x": 7000, "y": 0 }, isDefaultRow: true }
  },
  sections: {
    sec_y0gfgr: { name: "Onboarding Journeys", x: 0, y: 1600, width: 2920, height: 1180 },
    sec_bzem5w: { name: "Employee Directory", x: 0, y: 3580, width: 2920, height: 1180 }
  },
  layers: [
  { kind: "screen", id: "scr_oc2xo6" },
  { kind: "screen", id: "scr_eio01k" },
  { kind: "screen", id: "scr_zd77ci" },
  { kind: "screen", id: "scr_ge8zwt" },
  { kind: "screen", id: "scr_geocps" },
  { kind: "screen", id: "scr_zwclkf" },
  { kind: "section", id: "sec_y0gfgr", children: [
    { kind: "screen", id: "scr_xvlmb9" },
    { kind: "screen", id: "scr_bp4w6l" }]
  },
  { kind: "section", id: "sec_bzem5w", children: [
    { kind: "screen", id: "scr_txrzaw" },
    { kind: "screen", id: "scr_7rl6de" }]
  }]

};