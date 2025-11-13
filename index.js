/*
 * Aurora Movie Hub - Index Page
 *
 * This module handles fetching trending and top‑rated movies/TV shows from TMDB,
 * rendering the hero carousel, populating horizontal rows of media cards and
 * managing the overlay player for watching content. All API calls rely on
 * a TMDB API key – replace the placeholder with your own key.
 */

// === Configuration ===
// Replace with your TMDB API key. You can obtain one for free at
// https://developer.themoviedb.org. Do not commit secrets to public repos.
const API_KEY = 'REPLACE_WITH_YOUR_TMDB_KEY';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const WATCH_LATER_KEY = 'watchLaterItems';

// === Utility functions ===
/**
 * Perform a GET request against TMDB API.
 * @param {string} endpoint - API endpoint starting with a slash. Example: '/trending/movie/week'
 * @param {object} params - Additional query parameters.
 * @returns {Promise<object>} Parsed JSON response.
 */
async function fetchFromTMDB(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  // always include API key
  url.searchParams.append('api_key', API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }
  const res = await fetch(url.href);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${res.status}`);
  }
  return res.json();
}

/**
 * Get watch-later list from localStorage.
 */
function getWatchLater() {
  try {
    const stored = localStorage.getItem(WATCH_LATER_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save an item to watch-later. If already present, remove it.
 * @param {object} item - Media object containing at least id, media_type, title/name and poster_path.
 */
function toggleWatchLater(item) {
  const list = getWatchLater();
  const existingIndex = list.findIndex((i) => i.id === item.id && i.media_type === item.media_type);
  if (existingIndex > -1) {
    // remove
    list.splice(existingIndex, 1);
  } else {
    list.push(item);
  }
  localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(list));
  return existingIndex === -1; // returns true if added, false if removed
}

/**
 * Build video embed URL for external streaming provider (vidsrc).
 * This function constructs a link for movies or TV episodes based on the
 * TMDB id. If you want to use a different provider, adjust this accordingly.
 *
 * @param {string} type - 'movie' or 'tv'
 * @param {number} id - TMDB id
 * @param {number} [season] - Season number for tv
 * @param {number} [episode] - Episode number for tv
 */
function buildEmbedUrl(type, id, season, episode) {
  if (type === 'movie') {
    return `https://vidsrc.vercel.app/embed/movie?id=${id}`;
  }
  // default to first episode if none provided
  const s = season ?? 1;
  const e = episode ?? 1;
  return `https://vidsrc.vercel.app/embed/tv?id=${id}&season=${s}&episode=${e}`;
}

/**
 * Create a single media card element.
 * @param {object} item - TMDB media object
 * @returns {HTMLElement}
 */
function createMediaCard(item) {
  const card = document.createElement('div');
  card.className = 'media-card';
  const img = document.createElement('img');
  img.src = item.poster_path ? `${IMG_BASE_URL}${item.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
  img.alt = item.title || item.name;
  card.appendChild(img);
  const info = document.createElement('div');
  info.className = 'card-info';
  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  titleEl.textContent = item.title || item.name;
  const metaEl = document.createElement('div');
  metaEl.className = 'card-meta';
  // Rating badge
  const rating = document.createElement('span');
  rating.textContent = item.vote_average ? item.vote_average.toFixed(1) : '–';
  // Type badge
  const type = document.createElement('span');
  type.textContent = item.media_type === 'movie' || item.title ? 'Movie' : 'TV';
  metaEl.appendChild(type);
  metaEl.appendChild(rating);
  info.appendChild(titleEl);
  info.appendChild(metaEl);
  card.appendChild(info);
  // bookmark button
  const bookmark = document.createElement('button');
  bookmark.className = 'bookmark-btn';
  bookmark.innerHTML = '&#9733;';
  bookmark.title = 'Add to Watch Later';
  bookmark.addEventListener('click', (e) => {
    e.stopPropagation();
    const added = toggleWatchLater({
      id: item.id,
      media_type: item.media_type || (item.title ? 'movie' : 'tv'),
      title: item.title || item.name,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      overview: item.overview,
      vote_average: item.vote_average
    });
    bookmark.style.color = added ? '#ffd700' : '#fff';
  });
  // pre-check if in watch later
  const saved = getWatchLater().some(
    (i) => i.id === item.id && i.media_type === (item.media_type || (item.title ? 'movie' : 'tv'))
  );
  bookmark.style.color = saved ? '#ffd700' : '#fff';
  card.appendChild(bookmark);
  // card click behaviour
  card.addEventListener('click', () => {
    const typeVal = item.media_type || (item.title ? 'movie' : 'tv');
    const page = typeVal === 'movie' ? 'movie.html' : 'tv.html';
    window.location.href = `${page}?id=${item.id}`;
  });
  return card;
}

/**
 * Populate a row section with media cards.
 * @param {string} sectionId - DOM id of the row section
 * @param {Array<object>} items - List of media objects
 */
function populateRow(sectionId, items) {
  const section = document.getElementById(sectionId);
  const container = section.querySelector('.row-container');
  container.innerHTML = '';
  items.forEach((item) => {
    const card = createMediaCard(item);
    container.appendChild(card);
  });
}

// === Hero Carousel ===
let heroIndex = 0;
let heroInterval;
/**
 * Build the hero slides and start auto rotation.
 * @param {Array<object>} items - List of trending media
 */
function buildHeroCarousel(items) {
  const heroSection = document.getElementById('heroSection');
  items.forEach((item, idx) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide';
    if (idx === 0) slide.classList.add('active');
    slide.style.backgroundImage = item.backdrop_path
      ? `linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0)) , url(${IMG_BASE_URL.replace('w500', 'w1280')}${item.backdrop_path})`
      : '#000';
    // info container
    const info = document.createElement('div');
    info.className = 'hero-info';
    const title = document.createElement('h1');
    title.textContent = item.title || item.name;
    const pillBar = document.createElement('div');
    pillBar.className = 'pill-bar';
    // type pill
    const typePill = document.createElement('span');
    typePill.textContent = (item.media_type || (item.title ? 'movie' : 'tv')) === 'movie' ? 'Movie' : 'TV';
    typePill.style.background = 'var(--accent)';
    typePill.style.padding = '0.2rem 0.4rem';
    typePill.style.borderRadius = '5px';
    typePill.style.marginRight = '0.5rem';
    // rating pill
    const ratingPill = document.createElement('span');
    ratingPill.textContent = item.vote_average ? item.vote_average.toFixed(1) : '–';
    ratingPill.style.background = 'var(--card-bg)';
    ratingPill.style.padding = '0.2rem 0.4rem';
    ratingPill.style.borderRadius = '5px';
    ratingPill.style.marginRight = '0.5rem';
    pillBar.appendChild(typePill);
    pillBar.appendChild(ratingPill);
    const overview = document.createElement('p');
    overview.textContent = item.overview || '';
    // buttons
    const btnContainer = document.createElement('div');
    btnContainer.className = 'hero-buttons';
    const watchBtn = document.createElement('button');
    watchBtn.className = 'primary';
    watchBtn.textContent = 'Watch';
    watchBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = item.media_type || (item.title ? 'movie' : 'tv');
      openOverlay(item.id, type, item.title || item.name);
    });
    const infoBtn = document.createElement('button');
    infoBtn.className = 'secondary';
    infoBtn.textContent = 'More Info';
    infoBtn.addEventListener('click', () => {
      const type = item.media_type || (item.title ? 'movie' : 'tv');
      const page = type === 'movie' ? 'movie.html' : 'tv.html';
      window.location.href = `${page}?id=${item.id}`;
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'secondary';
    addBtn.textContent = 'Add to List';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const added = toggleWatchLater({
        id: item.id,
        media_type: item.media_type || (item.title ? 'movie' : 'tv'),
        title: item.title || item.name,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        overview: item.overview,
        vote_average: item.vote_average
      });
      addBtn.textContent = added ? 'Added' : 'Add to List';
    });
    btnContainer.appendChild(watchBtn);
    btnContainer.appendChild(infoBtn);
    btnContainer.appendChild(addBtn);
    info.appendChild(title);
    info.appendChild(pillBar);
    info.appendChild(overview);
    info.appendChild(btnContainer);
    slide.appendChild(info);
    heroSection.appendChild(slide);
  });
  // generate dots
  const dotsContainer = document.getElementById('hero-dots');
  dotsContainer.innerHTML = '';
  items.forEach((_item, idx) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if (idx === 0) dot.classList.add('active');
    dot.addEventListener('click', () => {
      showHeroSlide(idx);
    });
    dotsContainer.appendChild(dot);
  });
  // navigation buttons
  document.getElementById('hero-prev').onclick = () => {
    showHeroSlide((heroIndex - 1 + items.length) % items.length);
  };
  document.getElementById('hero-next').onclick = () => {
    showHeroSlide((heroIndex + 1) % items.length);
  };
  // start auto rotation
  clearInterval(heroInterval);
  heroInterval = setInterval(() => {
    showHeroSlide((heroIndex + 1) % items.length);
  }, 8000);
}

/**
 * Display a specific hero slide by index and update dots.
 * @param {number} index
 */
function showHeroSlide(index) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dots .dot');
  slides.forEach((slide, idx) => {
    slide.classList.toggle('active', idx === index);
  });
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === index);
  });
  heroIndex = index;
}

// === Overlay Player ===
/**
 * Open the overlay player with specified media.
 * @param {number} id - TMDB id
 * @param {string} type - 'movie' or 'tv'
 * @param {string} title - Display title
 */
function openOverlay(id, type, title) {
  const overlay = document.getElementById('overlayPlayer');
  overlay.classList.add('open');
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-subinfo').textContent = type === 'movie' ? '' : '';
  const iframe = document.getElementById('overlay-iframe');
  iframe.src = buildEmbedUrl(type, id);
}
// close overlay
function closeOverlay() {
  const overlay = document.getElementById('overlayPlayer');
  overlay.classList.remove('open');
  const iframe = document.getElementById('overlay-iframe');
  iframe.src = '';
}
document.getElementById('overlay-close').addEventListener('click', closeOverlay);
document.getElementById('overlayPlayer').addEventListener('click', (e) => {
  if (e.target.id === 'overlayPlayer') {
    closeOverlay();
  }
});

// === Initialization ===
async function init() {
  try {
    // Fetch trending all for hero (mix of movies and TV)
    const trendingAll = await fetchFromTMDB('/trending/all/week');
    buildHeroCarousel(trendingAll.results.slice(0, 5));
    // Trending movies row
    const trendingMovies = await fetchFromTMDB('/trending/movie/week');
    populateRow('rowTrendingMovies', trendingMovies.results.slice(0, 10));
    // Trending TV row
    const trendingTV = await fetchFromTMDB('/trending/tv/week');
    populateRow('rowTrendingTV', trendingTV.results.slice(0, 10));
    // Top rated row (mix movies and TV: fetch separately then combine)
    const [topMovies, topTV] = await Promise.all([
      fetchFromTMDB('/movie/top_rated'),
      fetchFromTMDB('/tv/top_rated'),
    ]);
    const combined = [...topMovies.results.slice(0, 5), ...topTV.results.slice(0, 5)];
    populateRow('rowTopRated', combined);
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);