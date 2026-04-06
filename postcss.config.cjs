module.exports = {
  plugins: {
    'postcss-preset-mantine': {
      // Automatically convert px values to rem (1rem = 16px by default).
      // Lets you write pixel values in CSS while shipping rem units.
      autoRem: true,
    },
    'postcss-simple-vars': {
      // Mantine breakpoint CSS variables — usable as $mantine-breakpoint-* in .css/.module.css files.
      // Matches the default Mantine breakpoints; adjust here to keep them in sync project-wide.
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
};