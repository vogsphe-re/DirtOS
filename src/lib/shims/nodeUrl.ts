const BrowserURL = URL;

export { BrowserURL as URL };

const nodeUrlShim = {
  URL: BrowserURL,
};

export default nodeUrlShim;
