/* Shop mega-menu (18 Sep 2026) — see assets/sahra-nav.css.
   Runs deferred, after each page's own inline mobile-menu builder, so it can
   (1) turn the existing "Shop" link into the trigger with a caret button,
   (2) append a full-width panel to the header, (3) hide Collection / T-Shirts /
   Polo from the desktop bar (they live inside the panel now, per the nav
   decision of 18 Sep), and (4) regroup the phone menu with the same links.
   Data lives here in one place; add a group when Sahel pages exist. */
(function () {
  'use strict';
  /* Belt and braces after the 18 Sep incident: one CDN edge answered 404 for the
     hashed stylesheet URL while the script loaded fine, so the page rendered the
     panel unstyled. If our sheet is present but empty, reload it unhashed. */
  try {
    var lk = document.querySelector('link[href*="/assets/sahra-nav.css"]');
    if (lk && lk.sheet && lk.sheet.cssRules.length === 0) {
      var fb = document.createElement('link'); fb.rel = 'stylesheet';
      fb.href = '/assets/sahra-nav.css?r=' + Date.now(); document.head.appendChild(fb);
    }
  } catch (e) {}
  var link = document.querySelector('.nav-links a[href="/shop/"], .hdr-nav a[href="/shop/"]');
  if (!link || document.querySelector('.sbn-panel')) return;
  var host = link.closest('header.hdr') || link.closest('nav');
  if (!host) return;
  var bar = link.parentNode;

  /* ---- data ---- */
  var GROUPS = [
    { h: 'By type', l: [
      ['/t-shirts/', 'T-shirts', 'Regular & Oversized'],
      ['/polos/', 'Polo', '240 GSM piqué'],
      ['/tote/', 'Accessories', 'The Sahra Tote'],
      ['/gifts/', 'Gifts', ''],
      ['/shop/', 'All products', '', 'sbn-all']
    ]},
    { h: 'By fit', l: [
      ['/shop/?fit=regular', 'Regular fit', 'slim, set shoulder'],
      ['/shop/?fit=oversized', 'Oversized fit', 'dropped shoulder'],
      ['/size-guide/', 'Size guide', '', 'sbn-all']
    ]},
    { h: 'By place', l: [
      ['/shop/?place=al-quaa-desert', 'Al Quaa', 'Abu Dhabi'],
      ['/shop/?place=liwa', 'Liwa · Empty Quarter', 'Abu Dhabi'],
      ['/shop/?place=wadi-naqab', 'Wadi Naqab', 'Ras Al Khaimah'],
      ['/places/', 'All places', '', 'sbn-all']
    ]}
  ];
  var FEAT = { href: '/#collection', img: '/shirts/card/alquaa-model-front.webp', badge: 'Founding Edition',
    title: 'The first run', text: 'Three places, three tees, one polo. Limited first run — when a size goes, it is gone.' };
  var FOOT = ['230 GSM tees · 240 GSM polo · printed collar labels', 'Order by 2 pm UAE time → next working day, free'];

  var TRAIL_SYM = 'M59.670,35.171 L59.672,35.169 L59.966,34.684 L60.261,34.201 L60.555,33.725 L60.847,33.255 L61.140,32.791 L61.434,32.332 L61.438,32.325 L61.728,31.881 L61.733,31.873 L62.022,31.436 L62.028,31.428 L62.319,30.998 L62.324,30.989 L62.616,30.566 L62.623,30.557 L62.917,30.140 L62.923,30.131 L63.219,29.721 L63.226,29.711 L63.525,29.307 L63.533,29.297 L63.834,28.899 L63.842,28.889 L64.147,28.496 L64.155,28.486 L64.464,28.098 L64.472,28.088 L64.786,27.705 L64.794,27.695 L65.112,27.316 L65.120,27.306 L65.443,26.931 L65.452,26.921 L65.780,26.549 L65.789,26.540 L66.123,26.171 L66.131,26.161 L66.471,25.795 L66.479,25.786 L66.826,25.421 L66.834,25.413 L67.187,25.050 L67.195,25.042 L67.554,24.680 L67.562,24.672 L67.928,24.310 L67.935,24.303 L68.309,23.942 L68.316,23.935 L68.696,23.574 L68.703,23.568 L68.762,23.512 L68.782,23.494 L68.833,23.451 L68.876,23.419 L68.920,23.389 L68.966,23.361 L69.013,23.335 L69.061,23.312 L69.110,23.291 L69.161,23.273 L69.212,23.258 L69.264,23.245 L69.316,23.235 L69.369,23.227 L69.423,23.222 L69.476,23.220 L69.530,23.221 L69.583,23.224 L69.636,23.230 L69.689,23.239 L69.741,23.250 L69.793,23.264 L69.844,23.281 L69.894,23.300 L69.942,23.321 L69.990,23.345 L70.048,23.379 L70.071,23.392 L70.201,23.475 L70.207,23.480 L70.717,23.812 L70.724,23.816 L71.226,24.149 L71.234,24.154 L71.729,24.489 L71.737,24.494 L72.225,24.831 L72.233,24.837 L72.713,25.175 L72.723,25.182 L73.196,25.524 L73.205,25.531 L73.672,25.875 L73.682,25.883 L74.141,26.231 L74.152,26.239 L74.605,26.591 L74.616,26.599 L75.064,26.957 L75.074,26.965 L75.517,27.327 L75.527,27.335 L75.965,27.703 L75.975,27.711 L76.408,28.084 L76.418,28.093 L76.848,28.472 L76.858,28.481 L77.284,28.867 L77.293,28.875 L77.716,29.268 L77.725,29.276 L78.146,29.676 L78.154,29.684 L78.573,30.091 L78.581,30.099 L78.998,30.513 L79.006,30.520 L79.422,30.942 L79.429,30.949 L79.844,31.378 L79.851,31.385 L80.266,31.822 L80.272,31.829 L80.687,32.273 L80.693,32.279 L81.108,32.729 L81.530,33.194 L81.954,33.666 L82.379,34.144 L82.806,34.628 L83.235,35.117 L83.667,35.612 L84.085,36.092 L84.120,36.130 L84.451,36.473 L84.526,36.544 L84.869,36.836 L84.950,36.900 L85.320,37.157 L85.408,37.212 L85.801,37.432 L85.894,37.478 L86.306,37.658 L86.403,37.695 L86.832,37.834 L86.931,37.861 L87.371,37.958 L87.473,37.975 L87.921,38.027 L88.024,38.035 L88.474,38.043 L88.578,38.040 L89.027,38.005 L89.129,37.991 L89.573,37.912 L89.674,37.889 L90.107,37.766 L90.205,37.734 L90.625,37.569 L90.719,37.527 L91.120,37.322 L91.210,37.271 L91.589,37.028 L91.674,36.968 L92.027,36.689 L92.105,36.621 L92.430,36.308 L92.501,36.233 L92.793,35.890 L92.856,35.809 L93.114,35.439 L93.169,35.351 L93.389,34.958 L93.435,34.865 L93.615,34.453 L93.652,34.356 L93.791,33.927 L93.818,33.828 L93.914,33.388 L93.931,33.286 L93.984,32.838 L93.991,32.735 L94.000,32.285 L93.997,32.181 L93.961,31.732 L93.948,31.630 L93.869,31.186 L93.846,31.085 L93.723,30.652 L93.690,30.554 L93.526,30.134 L93.484,30.040 L93.279,29.639 L93.227,29.549 L92.984,29.170 L92.924,29.085 L92.629,28.711 L92.596,28.672 L92.178,28.191 L91.737,27.687 L91.730,27.678 L91.729,27.678 L91.292,27.180 L91.291,27.178 L91.281,27.167 L91.280,27.166 L90.842,26.670 L90.841,26.668 L90.828,26.653 L90.826,26.652 L90.387,26.158 L90.385,26.156 L90.369,26.137 L90.367,26.135 L89.926,25.645 L89.924,25.642 L89.905,25.621 L89.902,25.618 L89.459,25.131 L89.457,25.128 L89.434,25.103 L89.432,25.100 L88.986,24.616 L88.984,24.614 L88.958,24.586 L88.955,24.583 L88.506,24.103 L88.504,24.100 L88.474,24.069 L88.471,24.066 L88.020,23.590 L88.017,23.587 L87.985,23.554 L87.981,23.550 L87.526,23.080 L87.523,23.076 L87.488,23.040 L87.484,23.037 L87.025,22.571 L87.021,22.568 L86.984,22.530 L86.980,22.526 L86.517,22.066 L86.513,22.062 L86.473,22.023 L86.469,22.019 L86.001,21.565 L85.997,21.561 L85.955,21.520 L85.951,21.516 L85.478,21.068 L85.474,21.063 L85.430,21.022 L85.425,21.018 L84.948,20.575 L84.944,20.571 L84.898,20.529 L84.893,20.525 L84.411,20.088 L84.406,20.084 L84.359,20.042 L84.354,20.037 L83.867,19.607 L83.862,19.603 L83.814,19.561 L83.809,19.556 L83.316,19.132 L83.311,19.128 L83.262,19.086 L83.257,19.082 L82.759,18.664 L82.754,18.660 L82.705,18.619 L82.699,18.615 L82.196,18.203 L82.191,18.199 L82.141,18.159 L82.136,18.155 L81.628,17.750 L81.623,17.746 L81.573,17.706 L81.568,17.702 L81.054,17.303 L81.049,17.299 L81.000,17.262 L80.995,17.258 L80.476,16.865 L80.472,16.861 L80.423,16.825 L80.418,16.821 L79.894,16.434 L79.890,16.430 L79.843,16.396 L79.838,16.392 L79.309,16.010 L79.304,16.007 L79.259,15.975 L79.254,15.971 L78.720,15.595 L78.716,15.592 L78.673,15.562 L78.668,15.558 L78.130,15.187 L78.126,15.184 L78.085,15.156 L78.080,15.153 L77.538,14.786 L77.534,14.784 L77.496,14.758 L77.491,14.755 L76.945,14.393 L76.941,14.391 L76.906,14.367 L76.902,14.365 L76.351,14.006 L76.348,14.004 L76.316,13.983 L76.312,13.981 L75.758,13.626 L75.755,13.624 L75.727,13.606 L75.724,13.604 L75.166,13.252 L75.164,13.251 L75.139,13.235 L75.136,13.234 L74.576,12.884 L74.574,12.883 L74.552,12.870 L74.550,12.869 L73.992,12.525 L73.986,12.521 L73.916,12.478 L73.908,12.474 L73.356,12.145 L73.338,12.135 L73.167,12.037 L73.149,12.027 L72.620,11.740 L72.565,11.712 L72.023,11.458 L71.967,11.433 L71.470,11.234 L71.429,11.219 L71.048,11.084 L70.964,11.059 L70.595,10.962 L70.510,10.943 L70.112,10.874 L70.069,10.867 L69.593,10.804 L69.547,10.799 L69.119,10.762 L69.025,10.758 L68.619,10.758 L68.526,10.763 L68.121,10.799 L68.028,10.812 L67.605,10.888 L67.560,10.897 L67.118,10.997 L67.069,11.010 L66.616,11.136 L66.520,11.168 L66.106,11.327 L66.013,11.369 L65.593,11.579 L65.548,11.603 L65.141,11.832 L65.075,11.872 L64.454,12.285 L64.391,12.330 L63.984,12.645 L63.964,12.661 L63.769,12.820 L63.749,12.836 L63.325,13.200 L63.318,13.206 L63.245,13.269 L63.237,13.276 L62.802,13.663 L62.800,13.665 L62.782,13.681 L62.780,13.683 L62.347,14.072 L62.345,14.074 L62.323,14.093 L62.320,14.095 L61.891,14.486 L61.888,14.488 L61.863,14.511 L61.860,14.514 L61.434,14.907 L61.431,14.909 L61.403,14.935 L61.400,14.938 L60.977,15.333 L60.974,15.336 L60.943,15.365 L60.940,15.368 L60.521,15.766 L60.517,15.770 L60.484,15.802 L60.480,15.805 L60.066,16.206 L60.062,16.210 L60.027,16.244 L60.023,16.248 L59.613,16.653 L59.609,16.656 L59.572,16.694 L59.568,16.698 L59.162,17.106 L59.158,17.110 L59.119,17.150 L59.115,17.154 L58.715,17.566 L58.711,17.570 L58.670,17.612 L58.666,17.617 L58.271,18.033 L58.267,18.037 L58.225,18.081 L58.221,18.086 L57.831,18.506 L57.827,18.511 L57.785,18.556 L57.780,18.561 L57.396,18.986 L57.392,18.991 L57.349,19.038 L57.345,19.043 L56.966,19.472 L56.962,19.477 L56.920,19.525 L56.915,19.531 L56.542,19.964 L56.537,19.969 L56.496,20.019 L56.491,20.024 L56.123,20.462 L56.119,20.467 L56.078,20.517 L56.073,20.522 L55.711,20.965 L55.707,20.970 L55.667,21.020 L55.662,21.026 L55.305,21.474 L55.301,21.478 L55.262,21.528 L55.258,21.534 L54.906,21.986 L54.903,21.991 L54.865,22.040 L54.861,22.045 L54.514,22.503 L54.511,22.507 L54.475,22.556 L54.471,22.561 L54.129,23.022 L54.126,23.027 L54.092,23.074 L54.088,23.079 L53.752,23.545 L53.748,23.550 L53.716,23.595 L53.713,23.600 L53.381,24.070 L53.378,24.074 L53.347,24.118 L53.344,24.122 L53.017,24.597 L53.014,24.601 L52.986,24.642 L52.983,24.646 L52.660,25.125 L52.657,25.129 L52.631,25.167 L52.629,25.171 L52.309,25.653 L52.307,25.657 L52.284,25.692 L52.281,25.696 L51.965,26.181 L51.963,26.184 L51.942,26.217 L51.940,26.220 L51.627,26.709 L51.625,26.712 L51.607,26.740 L51.605,26.743 L51.295,27.235 L51.293,27.237 L51.277,27.262 L51.276,27.265 L50.968,27.759 L50.967,27.761 L50.953,27.782 L50.952,27.785 L50.646,28.281 L50.645,28.283 L50.635,28.300 L50.633,28.302 L50.329,28.800 L50.328,28.801 L50.320,28.814 L50.319,28.816 L50.016,29.316 L50.010,29.325 L50.010,29.326 L49.707,29.827 L49.415,30.312 L49.389,30.357 L49.163,30.777 L49.119,30.870 L48.945,31.286 L48.910,31.383 L48.778,31.814 L48.753,31.914 L48.664,32.356 L48.649,32.458 L48.603,32.906 L48.598,33.010 L48.597,33.460 L48.602,33.563 L48.645,34.012 L48.660,34.114 L48.746,34.556 L48.771,34.657 L48.901,35.088 L48.936,35.186 L49.107,35.602 L49.151,35.696 L49.362,36.094 L49.415,36.182 L49.665,36.558 L49.726,36.641 L50.011,36.990 L50.080,37.067 L50.398,37.386 L50.474,37.456 L50.822,37.742 L50.905,37.804 L51.279,38.055 L51.367,38.109 L51.764,38.322 L51.857,38.367 L52.273,38.540 L52.370,38.575 L52.801,38.707 L52.901,38.732 L53.343,38.821 L53.445,38.837 L53.894,38.882 L53.997,38.887 L54.447,38.889 L54.551,38.884 L54.999,38.841 L55.101,38.826 L55.543,38.739 L55.644,38.714 L56.075,38.584 L56.173,38.550 L56.589,38.378 L56.683,38.334 L57.081,38.123 L57.170,38.070 L57.545,37.821 L57.628,37.759 L57.977,37.475 L58.054,37.405 L58.373,37.088 L58.443,37.011 L58.729,36.664 L58.791,36.581 L59.057,36.185 L59.085,36.142 L59.372,35.665 L59.670,35.171 Z M19.811,83.500 L19.812,83.498 L20.287,82.535 L20.762,81.578 L21.238,80.629 L21.716,79.689 L22.196,78.757 L22.680,77.833 L22.683,77.826 L23.167,76.920 L23.171,76.912 L23.658,76.016 L23.663,76.008 L24.155,75.122 L24.160,75.113 L24.657,74.237 L24.663,74.228 L25.167,73.362 L25.172,73.352 L25.683,72.497 L25.689,72.486 L26.207,71.640 L26.214,71.630 L26.740,70.793 L26.747,70.782 L27.281,69.954 L27.288,69.943 L27.832,69.123 L27.840,69.112 L28.393,68.300 L28.400,68.289 L28.964,67.485 L28.971,67.474 L29.545,66.677 L29.553,66.666 L30.137,65.875 L30.145,65.864 L30.740,65.078 L30.748,65.068 L31.354,64.288 L31.362,64.278 L31.980,63.501 L31.988,63.492 L32.617,62.719 L32.624,62.711 L33.266,61.941 L33.273,61.933 L33.925,61.165 L33.932,61.157 L34.596,60.392 L34.603,60.385 L35.278,59.620 L35.284,59.614 L35.971,58.849 L35.976,58.843 L36.672,58.080 L37.384,57.309 L37.863,56.797 L37.881,56.779 L37.928,56.734 L37.967,56.699 L38.007,56.667 L38.050,56.637 L38.093,56.609 L38.138,56.583 L38.185,56.559 L38.232,56.538 L38.281,56.519 L38.330,56.502 L38.380,56.488 L38.431,56.476 L38.482,56.467 L38.533,56.460 L38.585,56.456 L38.637,56.455 L38.689,56.456 L38.741,56.460 L38.793,56.466 L38.844,56.474 L38.895,56.486 L38.945,56.499 L38.994,56.516 L39.043,56.534 L39.102,56.561 L39.126,56.572 L39.667,56.843 L40.781,57.409 L41.886,57.978 L42.982,58.552 L42.989,58.556 L44.067,59.131 L44.075,59.135 L45.142,59.715 L45.150,59.719 L46.205,60.306 L46.214,60.311 L47.258,60.904 L47.268,60.910 L48.301,61.511 L48.311,61.517 L49.333,62.126 L49.343,62.133 L50.354,62.752 L50.365,62.758 L51.365,63.387 L51.376,63.394 L52.366,64.033 L52.377,64.040 L53.358,64.691 L53.369,64.698 L54.340,65.360 L54.351,65.368 L55.314,66.042 L55.324,66.049 L56.279,66.736 L56.289,66.743 L57.236,67.442 L57.246,67.450 L58.186,68.162 L58.196,68.170 L59.130,68.895 L59.139,68.903 L60.067,69.641 L60.076,69.649 L60.999,70.401 L61.008,70.408 L61.926,71.173 L61.935,71.180 L62.850,71.959 L62.858,71.965 L63.770,72.757 L63.777,72.763 L64.687,73.567 L64.694,73.573 L65.602,74.389 L65.608,74.395 L66.515,75.222 L67.429,76.066 L68.343,76.921 L69.259,77.785 L70.176,78.658 L71.096,79.538 L72.019,80.425 L72.927,81.300 L72.965,81.335 L73.408,81.721 L73.489,81.785 L73.946,82.111 L74.033,82.167 L74.520,82.446 L74.612,82.493 L75.124,82.724 L75.220,82.761 L75.752,82.941 L75.852,82.969 L76.399,83.095 L76.501,83.113 L77.057,83.185 L77.160,83.193 L77.721,83.210 L77.825,83.208 L78.385,83.170 L78.487,83.158 L79.041,83.065 L79.142,83.043 L79.684,82.896 L79.782,82.864 L80.307,82.665 L80.402,82.624 L80.905,82.374 L80.995,82.324 L81.471,82.026 L81.556,81.967 L82.000,81.624 L82.079,81.557 L82.488,81.173 L82.559,81.098 L82.928,80.675 L82.992,80.594 L83.318,80.137 L83.374,80.050 L83.653,79.563 L83.700,79.471 L83.931,78.959 L83.969,78.863 L84.148,78.331 L84.176,78.231 L84.302,77.684 L84.320,77.583 L84.392,77.026 L84.400,76.923 L84.417,76.362 L84.415,76.258 L84.377,75.698 L84.365,75.596 L84.272,75.042 L84.250,74.941 L84.103,74.399 L84.071,74.301 L83.872,73.776 L83.831,73.681 L83.582,73.178 L83.531,73.088 L83.233,72.612 L83.174,72.527 L82.832,72.083 L82.764,72.004 L82.362,71.577 L82.326,71.540 L81.416,70.664 L80.482,69.766 L80.472,69.757 L80.471,69.756 L79.541,68.866 L79.540,68.865 L79.527,68.852 L79.526,68.851 L78.594,67.964 L78.592,67.963 L78.575,67.946 L78.573,67.945 L77.639,67.063 L77.637,67.061 L77.615,67.040 L77.613,67.038 L76.675,66.162 L76.673,66.160 L76.647,66.135 L76.644,66.133 L75.703,65.263 L75.700,65.260 L75.670,65.232 L75.667,65.230 L74.721,64.367 L74.718,64.364 L74.683,64.333 L74.680,64.330 L73.729,63.476 L73.726,63.473 L73.687,63.438 L73.684,63.436 L72.727,62.590 L72.723,62.587 L72.681,62.550 L72.677,62.546 L71.714,61.710 L71.710,61.707 L71.664,61.668 L71.660,61.664 L70.690,60.839 L70.685,60.835 L70.636,60.794 L70.632,60.790 L69.654,59.975 L69.650,59.972 L69.597,59.929 L69.593,59.925 L68.607,59.122 L68.603,59.118 L68.547,59.074 L68.543,59.070 L67.549,58.279 L67.544,58.275 L67.486,58.229 L67.481,58.225 L66.479,57.447 L66.474,57.443 L66.414,57.397 L66.409,57.393 L65.398,56.627 L65.393,56.623 L65.331,56.577 L65.326,56.573 L64.306,55.820 L64.301,55.816 L64.237,55.770 L64.232,55.766 L63.203,55.026 L63.198,55.022 L63.133,54.976 L63.128,54.972 L62.090,54.246 L62.084,54.242 L62.020,54.197 L62.014,54.193 L60.967,53.479 L60.961,53.476 L60.896,53.432 L60.891,53.428 L59.834,52.727 L59.829,52.724 L59.764,52.682 L59.758,52.678 L58.693,51.990 L58.688,51.986 L58.624,51.946 L58.618,51.942 L57.544,51.267 L57.539,51.264 L57.476,51.225 L57.471,51.221 L56.387,50.558 L56.382,50.555 L56.321,50.518 L56.316,50.515 L55.224,49.863 L55.219,49.861 L55.161,49.826 L55.156,49.823 L54.056,49.183 L54.051,49.180 L53.995,49.148 L53.990,49.145 L52.882,48.515 L52.878,48.513 L52.825,48.483 L52.821,48.481 L51.705,47.861 L51.701,47.859 L51.652,47.832 L51.647,47.829 L50.525,47.219 L50.521,47.217 L50.476,47.192 L50.472,47.190 L49.343,46.588 L49.340,46.587 L49.298,46.565 L49.295,46.563 L48.160,45.969 L48.157,45.967 L48.120,45.948 L48.117,45.946 L46.977,45.359 L46.974,45.358 L46.942,45.341 L46.939,45.340 L45.794,44.758 L45.792,44.757 L45.765,44.744 L45.763,44.742 L44.619,44.168 L44.612,44.165 L44.525,44.122 L44.517,44.118 L43.380,43.570 L43.362,43.561 L43.151,43.464 L43.133,43.456 L42.031,42.974 L41.976,42.952 L41.315,42.706 L41.259,42.687 L40.230,42.369 L40.168,42.352 L39.462,42.180 L39.336,42.158 L38.615,42.073 L38.551,42.067 L37.599,42.014 L37.553,42.012 L37.025,42.005 L36.932,42.008 L36.429,42.047 L36.337,42.058 L35.839,42.140 L35.748,42.159 L35.237,42.291 L35.192,42.304 L34.331,42.567 L34.282,42.583 L33.726,42.784 L33.630,42.824 L33.120,43.067 L33.028,43.116 L32.523,43.422 L32.479,43.450 L31.691,43.980 L31.659,44.003 L31.294,44.269 L31.231,44.319 L30.888,44.612 L30.858,44.638 L30.104,45.332 L30.085,45.350 L29.856,45.572 L29.837,45.591 L29.093,46.349 L29.086,46.356 L29.003,46.442 L28.995,46.450 L28.247,47.242 L28.246,47.244 L28.225,47.266 L28.223,47.268 L27.480,48.063 L27.478,48.066 L27.453,48.092 L27.451,48.094 L26.713,48.893 L26.711,48.895 L26.682,48.926 L26.680,48.928 L25.948,49.731 L25.946,49.734 L25.914,49.768 L25.912,49.771 L25.187,50.578 L25.184,50.581 L25.150,50.620 L25.147,50.623 L24.430,51.435 L24.427,51.438 L24.389,51.481 L24.386,51.484 L23.677,52.301 L23.674,52.305 L23.635,52.351 L23.631,52.355 L22.931,53.178 L22.928,53.182 L22.886,53.231 L22.883,53.235 L22.192,54.064 L22.188,54.069 L22.145,54.121 L22.141,54.126 L21.461,54.961 L21.457,54.966 L21.412,55.021 L21.409,55.026 L20.738,55.868 L20.734,55.873 L20.689,55.931 L20.685,55.936 L20.025,56.785 L20.021,56.790 L19.975,56.850 L19.971,56.856 L19.321,57.713 L19.318,57.718 L19.271,57.780 L19.267,57.785 L18.629,58.649 L18.625,58.655 L18.579,58.718 L18.575,58.723 L17.948,59.596 L17.944,59.601 L17.898,59.665 L17.894,59.671 L17.278,60.551 L17.274,60.556 L17.229,60.621 L17.226,60.627 L16.621,61.514 L16.617,61.520 L16.573,61.585 L16.569,61.590 L15.975,62.486 L15.972,62.491 L15.929,62.556 L15.926,62.562 L15.343,63.465 L15.339,63.470 L15.299,63.534 L15.295,63.540 L14.722,64.451 L14.719,64.456 L14.680,64.518 L14.677,64.524 L14.115,65.442 L14.112,65.447 L14.075,65.508 L14.072,65.513 L13.519,66.439 L13.516,66.444 L13.482,66.502 L13.479,66.507 L12.936,67.440 L12.933,67.445 L12.901,67.501 L12.898,67.505 L12.364,68.445 L12.362,68.449 L12.332,68.502 L12.330,68.507 L11.804,69.452 L11.802,69.456 L11.775,69.506 L11.773,69.510 L11.255,70.462 L11.253,70.466 L11.228,70.511 L11.226,70.515 L10.716,71.472 L10.714,71.476 L10.692,71.517 L10.690,71.521 L10.186,72.483 L10.185,72.486 L10.166,72.523 L10.164,72.526 L9.666,73.493 L9.665,73.496 L9.648,73.528 L9.647,73.531 L9.154,74.502 L9.152,74.504 L9.139,74.531 L9.138,74.533 L8.649,75.508 L8.648,75.510 L8.637,75.531 L8.636,75.533 L8.150,76.511 L8.149,76.512 L8.141,76.529 L8.140,76.530 L7.657,77.510 L7.651,77.522 L7.651,77.523 L7.169,78.504 L6.696,79.471 L6.675,79.518 L6.443,80.057 L6.407,80.154 L6.236,80.689 L6.210,80.789 L6.093,81.338 L6.077,81.440 L6.014,81.998 L6.008,82.101 L6.000,82.662 L6.004,82.765 L6.051,83.325 L6.065,83.427 L6.167,83.979 L6.191,84.080 L6.347,84.619 L6.380,84.717 L6.588,85.238 L6.631,85.332 L6.889,85.831 L6.941,85.920 L7.246,86.391 L7.307,86.475 L7.657,86.914 L7.725,86.991 L8.117,87.394 L8.193,87.464 L8.622,87.826 L8.704,87.889 L9.166,88.207 L9.254,88.261 L9.746,88.532 L9.839,88.578 L10.354,88.799 L10.451,88.836 L10.986,89.006 L11.086,89.032 L11.635,89.149 L11.737,89.166 L12.295,89.228 L12.398,89.235 L12.959,89.242 L13.063,89.238 L13.622,89.191 L13.725,89.177 L14.277,89.075 L14.377,89.051 L14.916,88.896 L15.014,88.862 L15.536,88.654 L15.630,88.611 L16.128,88.353 L16.218,88.301 L16.689,87.996 L16.772,87.935 L17.211,87.585 L17.289,87.517 L17.691,87.125 L17.761,87.050 L18.123,86.620 L18.186,86.538 L18.504,86.076 L18.558,85.988 L18.842,85.474 L18.866,85.428 L19.334,84.472 L19.811,83.500 Z';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function row(a) {
    return '<a class="sbn-l' + (a[3] ? ' ' + a[3] : '') + '" href="' + esc(a[0]) + '">' + esc(a[1]) +
      (a[2] ? ' <small>' + esc(a[2]) + '</small>' : '') + '</a>';
  }

  /* ---- desktop: trigger + panel ---- */
  var trig = document.createElement('span');
  trig.className = 'sbn-trig';
  link.parentNode.insertBefore(trig, link);
  trig.appendChild(link);
  var caret = document.createElement('button');
  caret.type = 'button'; caret.className = 'sbn-caret';
  caret.setAttribute('aria-label', 'Open the shop menu');
  caret.setAttribute('aria-expanded', 'false');
  caret.setAttribute('aria-controls', 'sbnPanel');
  caret.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4.5l4 4 4-4"/></svg>';
  trig.appendChild(caret);

  var panel = document.createElement('div');
  panel.className = 'sbn-panel'; panel.id = 'sbnPanel';
  panel.setAttribute('aria-label', 'Shop menu');
  panel.innerHTML = GROUPS.map(function (g) {
    return '<div class="sbn-col"><span class="sbn-h">' + esc(g.h) + '</span>' + g.l.map(row).join('') + '</div>';
  }).join('') +
    '<div class="sbn-col"><span class="sbn-h">Edition</span><a class="sbn-feat" href="' + esc(FEAT.href) + '"' + (FEAT.href.indexOf('/#') === 0 ? ' data-ring-jump' : '') + '>' +
    '<img src="' + esc(FEAT.img) + '" alt="" loading="lazy" width="96" height="120">' +
    '<div><span class="sbn-badge">' + esc(FEAT.badge) + '</span><b>' + esc(FEAT.title) + '</b><span>' + esc(FEAT.text) + '</span></div></a></div>' +
    /* Sahra Trail, the activewear line (24 Sep 2026): its own column until the first run is on sale */
    '<div class="sbn-col sbn-trail-col"><span class="sbn-h">Sahra Trail · activewear</span>' +
    '<a class="sbn-trailcard" href="/trail/"><svg viewBox="6 10.76 88 78.48" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="' + TRAIL_SYM + '"/></svg>' +
    '<span><b>Coming this season</b><small>Trail and run wear, designed in the UAE</small></span></a>' +
    row(['/trail/', 'Sun Tee', 'coming soon']) + row(['/trail/', '2-in-1 Trail Short', 'coming soon']) +
    row(['/trail/#first-access', 'Get first access', '', 'sbn-all']) + '</div>' +
    '<div class="sbn-foot"><span>' + esc(FOOT[0]) + '</span><span>' + esc(FOOT[1]) + '</span></div>';
  var pos = getComputedStyle(host).position;
  if (pos === 'static') host.style.position = 'relative';
  host.appendChild(panel);

  /* links that moved into the panel leave the desktop bar */
  ['/#collection', '/t-shirts/', '/polos/'].forEach(function (h) {
    var a = bar.querySelector('a[href="' + h + '"]');
    if (a) a.classList.add('sbn-hide');
  });

  /* ---- open / close ---- */
  var hoverable = window.matchMedia('(hover:hover) and (min-width:821px)');
  var timer = null, open = false;
  function set(o) {
    open = o; host.classList.toggle('sbn-open', o);
    caret.setAttribute('aria-expanded', o ? 'true' : 'false');
  }
  function later(o, ms) { clearTimeout(timer); timer = setTimeout(function () { set(o); }, ms); }
  [trig, panel].forEach(function (el) {
    el.addEventListener('mouseenter', function () { if (hoverable.matches) later(true, 60); });
    el.addEventListener('mouseleave', function () { if (hoverable.matches) later(false, 160); });
  });
  caret.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); clearTimeout(timer); set(!open); });
  document.addEventListener('click', function (e) { if (open && !host.contains(e.target)) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) { set(false); caret.focus(); } });
  panel.addEventListener('focusout', function () {
    setTimeout(function () { if (open && !panel.contains(document.activeElement) && document.activeElement !== caret) set(false); }, 0);
  });
  window.addEventListener('scroll', function () { if (open && !panel.matches(':hover')) set(false); }, { passive: true });
  document.addEventListener('mousemove', function (e) { if (open && hoverable.matches && !host.contains(e.target)) later(false, 160); }, { passive: true });

  /* ---- phone: regroup the slide-down menu built by the page ---- */
  var m = document.getElementById('mobileNav');
  if (m) {
    var keep = m.querySelector('.m-close');
    [].slice.call(m.querySelectorAll('a')).forEach(function (a) { a.parentNode.removeChild(a); });
    var cur = location.pathname.replace(/index\.html$/, '');
    function ma(href, label, sub) {
      var a = document.createElement('a');
      a.href = href; a.textContent = label; if (sub) a.className = 'sbn-sub';
      if (href === cur) a.setAttribute('aria-current', 'page');
      return a;
    }
    function mh(t) { var s = document.createElement('span'); s.className = 'sbn-mh'; s.textContent = t; return s; }
    var frag = document.createDocumentFragment();
    frag.appendChild(mh('Shop'));
    frag.appendChild(ma('/shop/', 'All products'));
    frag.appendChild(ma('/t-shirts/', 'T-shirts', true));
    frag.appendChild(ma('/polos/', 'Polo', true));
    frag.appendChild(ma('/tote/', 'Accessories', true));
    frag.appendChild(ma('/shop/?fit=regular', 'Regular fit', true));
    frag.appendChild(ma('/shop/?fit=oversized', 'Oversized fit', true));
    frag.appendChild(ma('/gifts/', 'Gifts', true));
    frag.appendChild(mh('Sahra Trail · activewear'));
    frag.appendChild(ma('/trail/', 'Coming this season'));
    frag.appendChild(mh('Places'));
    frag.appendChild(ma('/places/', 'All places'));
    frag.appendChild(ma('/shop/?place=al-quaa-desert', 'Al Quaa', true));
    frag.appendChild(ma('/shop/?place=liwa', 'Liwa · Empty Quarter', true));
    frag.appendChild(ma('/shop/?place=wadi-naqab', 'Wadi Naqab', true));
    frag.appendChild(mh('More'));
    frag.appendChild(ma('/#collection', 'The Founding Edition'));
    frag.appendChild(ma('/size-guide/', 'Size guide'));
    frag.appendChild(ma('/about/', 'About'));
    frag.appendChild(ma('/contact/', 'Contact'));
    m.appendChild(frag);
    if (keep && keep !== m.firstChild) m.insertBefore(keep, m.firstChild);
  }
})();
/* Language switch (23 Sep 2026, CRO review): a visible English / عربي link in
   every header. The target is this page's own counterpart where one exists
   (the hreflang alternate, then /products/<id>/ <-> /ar/products/<id>/),
   otherwise the other language's home. */
(function () {
  'use strict';
  function place() {
    if (document.querySelector('.sbl-lang')) return;
    var html = document.documentElement, ar = (html.getAttribute('lang') || '').slice(0, 2) === 'ar';
    var p = location.pathname || '/', href;
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + (ar ? 'en' : 'ar') + '"]');
    if (alt) { try { href = new URL(alt.href).pathname; } catch (e) {} }
    if (!href) {
      var m = ar ? /^\/ar\/products\/([^\/]+)\/?$/.exec(p) : /^\/products\/([^\/]+)\/?$/.exec(p);
      if (m) href = ar ? '/products/' + m[1] + '/' : '/ar/products/' + m[1] + '/';
      else if (!ar && /^\/shop\/?$/.test(p)) href = '/ar/shop/';
      else if (ar && /^\/ar\/shop\/?$/.test(p)) href = '/shop/';
      else href = ar ? '/' : '/ar/';
    }
    var hdr = document.querySelector('.hdr') || document.getElementById('nav') || document.querySelector('body > nav') || document.querySelector('nav');
    if (!hdr) return;
    function mk(cls) {
      var a = document.createElement('a');
      a.className = 'sbl-lang ' + cls; a.href = href;
      a.setAttribute('hreflang', ar ? 'en' : 'ar'); a.setAttribute('lang', ar ? 'en' : 'ar');
      a.textContent = ar ? 'English' : 'العربية';   /* the same word the /ar/ pages use */
      a.setAttribute('aria-label', ar ? 'Read this page in English' : 'اقرأ بالعربية — Arabic');
      a.addEventListener('click', function () { try { if (window.track) track('language_switch', { to: ar ? 'en' : 'ar', from_path: p }); } catch (e) {} });
      return a;
    }
    /* desktop: the last item of the link row; phone (the row is hidden): beside the cart */
    var row = hdr.querySelector('.nav-links, .hdr-nav');
    var before = hdr.querySelector('#sbCartBtn, #cartBtn, .cart-btn, .sb-cart-btn, .mnav');
    var m = mk(row ? 'sbl-m' : 'sbl-any');
    if (before && before.parentNode) before.parentNode.insertBefore(m, before); else hdr.appendChild(m);
    if (row) row.appendChild(mk('sbl-d'));
    /* phones (24 Sep): the header bar has no room - the link overlapped the
       wordmark at 360-390px - so it moves to the top of the slide-down menu */
    var mn = document.getElementById('mobileNav');
    if (mn) {
      var mi = mk('sbl-menu'), close = mn.querySelector('.m-close');
      if (close && close.nextSibling) mn.insertBefore(mi, close.nextSibling); else mn.insertBefore(mi, mn.firstChild);
      document.documentElement.classList.add('sbl-in-menu');
    }
  }
  function later() { setTimeout(place, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', later); else later();
})();

/* Sahra Trail top-bar link (24 Sep 2026): after Shop on English pages, after
   the shop link on Arabic ones. Injected here so every template, hand-kept or
   generated, gets it from one place. */
(function () {
  'use strict';
  var ar = (document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'ar';
  var row = document.querySelector('.nav-links, .hdr-nav');
  if (!row || row.querySelector('.sbn-trail')) return;
  var a = document.createElement('a');
  a.className = 'sbn-trail'; a.href = ar ? '/ar/trail/' : '/trail/';
  if (/^\/(ar\/)?trail\/?$/.test(location.pathname)) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
  a.innerHTML = 'Sahra Trail<span class="sbn-soon">' + (ar ? '\u0642\u0631\u064a\u0628\u064b\u0627' : 'Soon') + '</span>';
  var after = row.querySelector('.sbn-trig') || row.querySelector('a[href="/shop/"], a[href="/ar/shop/"]');
  if (after && after.parentNode === row) row.insertBefore(a, after.nextSibling); else row.insertBefore(a, row.firstChild);
  var mn = document.getElementById('mobileNav');
  if (mn && !mn.querySelector('a[href$="/trail/"]')) {
    var m = a.cloneNode(true); m.classList.remove('active');
    var close = mn.querySelector('.m-close');
    mn.insertBefore(m, close ? close.nextSibling : mn.firstChild);
  }
})();
