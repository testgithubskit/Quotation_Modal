// Design tokens for Quotation Modal
// Palette chosen for a lab/testing-services quotation & reporting tool:
// deep ledger-navy for structure + authority, warm brass for accents/actions,
// warm off-white surface (not stark white) so long tables are easy on the eye.
export const palette = {
  navy: '#16324F',       // primary — headers, active nav, primary buttons
  navyDeep: '#0E2338',    // hover/active states
  brass: '#B8863A',       // accent — highlights, badges, "design template" actions
  brassLight: '#E8C88A',
  paper: '#FAF9F6',       // app background
  surface: '#FFFFFF',     // card/table surface
  line: '#E4E0D8',        // hairline borders
  ink: '#1C1E22',         // primary text
  inkSoft: '#5B6169',     // secondary text
  success: '#2F7A4F',
  danger: '#B3432B',
};

export const antdTheme = {
  token: {
    colorPrimary: palette.navy,
    colorLink: palette.navy,
    colorSuccess: palette.success,
    colorError: palette.danger,
    colorBgLayout: palette.paper,
    colorBgContainer: palette.surface,
    colorBorder: palette.line,
    colorBorderSecondary: palette.line,
    colorText: palette.ink,
    colorTextSecondary: palette.inkSoft,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    borderRadius: 4,
    borderRadiusLG: 6,
    fontSize: 14,
  },
  components: {
    Layout: {
      headerBg: palette.navy,
      siderBg: palette.navy,
      bodyBg: palette.paper,
      headerHeight: 60,
    },
    Menu: {
      darkItemBg: palette.navy,
      darkItemSelectedBg: palette.navyDeep,
      darkItemHoverBg: 'rgba(255,255,255,0.06)',
      darkItemColor: 'rgba(255,255,255,0.75)',
      darkItemSelectedColor: palette.brassLight,
    },
    Table: {
      headerBg: '#F1EEE6',
      headerColor: palette.ink,
      borderColor: palette.line,
      rowHoverBg: '#F7F5EF',
    },
    Button: {
      primaryShadow: 'none',
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: 6,
    },
  },
};
