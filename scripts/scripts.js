import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadCSS,
} from './aem.js';

document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('https://pizza-grader.chrislotton.workers.dev/api/results');
  const latestScores = await res.json();

  // Map pizza names to scores for easy lookup
  const scoreMap = new Map();
  latestScores.forEach(entry => {
    scoreMap.set(entry.pizza, entry);
  });

  function updateCellDisplay(cell, score) {
    cell.innerHTML = ''; // Clear existing slices
    for (let i = 0; i < score; i++) {
      let slice = document.createElement('div');
      slice.classList.add('pizza-slice');
      cell.appendChild(slice);
    }
  }

  // Loop through rows and update cell displays
  document.querySelectorAll('#pizzaTable tbody tr').forEach(tr => {
    const pizza = tr.querySelector('img')?.alt || 'Unknown';
    const cells = tr.querySelectorAll('.score-cell');

    const scores = scoreMap.get(pizza);
    if (scores) {
      const values = [
        scores.sauce,
        scores.cheese,
        scores.toppings,
        scores.crust,
        scores.value,
        scores.delivery,
        scores.boxDesign,
        scores.dayAfter
      ];

      values.forEach((score, i) => {
        const cell = cells[i];
        cell.setAttribute('data-score', score);
        updateCellDisplay(cell, score);
      });
    }
  });

  // Now attach click handlers for scoring
  document.querySelectorAll('.score-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      let currentScore = parseInt(cell.getAttribute('data-score'));
      let newScore = currentScore === 5 ? 0 : (currentScore % 5) + 1;
      cell.setAttribute('data-score', newScore);
      updateCellDisplay(cell, newScore);
      debounceSubmit();
    });
  });
});

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

let debounceTimeout;

function sendScoresToWorker() {
  const rows = [];
  document.querySelectorAll('#pizzaTable tbody tr').forEach(tr => {
    const pizza = tr.querySelector('img')?.alt || 'Unknown';
    const cells = tr.querySelectorAll('.score-cell');
    rows.push({
      pizza,
      scores: {
        sauce: parseInt(cells[0].dataset.score || 0),
        cheese: parseInt(cells[1].dataset.score || 0),
        toppings: parseInt(cells[2].dataset.score || 0),
        crust: parseInt(cells[3].dataset.score || 0),
        value: parseInt(cells[4].dataset.score || 0),
        delivery: parseInt(cells[5].dataset.score || 0),
        boxDesign: parseInt(cells[6].dataset.score || 0),
        dayAfter: parseInt(cells[6].dataset.score || 0),
      }
    });
  });

  fetch('https://pizza-grader.chrislotton.workers.dev/api/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ rows })
  }).then(res => {
    console.log('Saved:', res.status);
  }).catch(err => console.error('Error saving:', err));
}

function debounceSubmit() {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    sendScoresToWorker();
  }, 1000); // Save 1s after last interaction
}

loadPage();
