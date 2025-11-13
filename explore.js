/*
 * Aurora Movie Hub - Explore Page
 *
 * Provides a discovery interface with a search bar and simple type filters. Uses
 * TMDB multi-search to fetch movies and TV shows by title. Results are
 * displayed in a responsive grid. Users can watch directly via overlay or add
 * items to their watch later list.
 */

const API_KEY = 'REPLACE_WITH_YOUR_TMDB_KEY';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const WATCH_LATER_KEY = 'watchLaterItems';

async function fetchFromTMDB(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }
  const res = await fetch(url.href);
  if (!res.ok) throw new Error('API error');
  return res.json();
}
function getWatchLater() {
  try {
    return JSON.parse(localStorage.getItem(WATCH_LATER_KEY) || '[]');
  } catch {
    return [];
  }
}
function toggleWatchLater(item) {
  const list = getWatchLater();
  const idx = list.findIndex((i) => i.id === item.id && i.media_type === item.media_type);
  if (idx > -1) list.splice(idx, 1);
  else list.push(item);
  localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(list));
  return idx === -1;
}
function buildEmbedUrl(type, id) {
  return type === 'movie'
    ? `https://vidsrc.vercel.app/embed/movie?id=${id}`
    : `https://vidsrc.vercel.app/embed/tv?id=${id}&season=1&episode=1`;
}
function openOverlay(id, type, title) {
  const overlay = document.getElementById('overlayPlayer');
  overlay.classList.add('open');
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-iframe').src = buildEmbedUrl(type, id);
}
function closeOverlay() {
  const overlay = document.getElementById('overlayPlayer');
  overlay.classList.remove('open');
  document.getElementById('overlay-iframe').src = '';
}
document.getElementById('overlay-close').addEventListener('click', closeOverlay);
document.getElementById('overlayPlayer').addEventListener('click', (e) => {
  if (e.target.id === 'overlayPlayer') closeOverlay();
});

function createCard(item) {
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
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const type = document.createElement('span');
  type.textContent = item.media_type === 'movie' ? 'Movie' : 'TV';
  const rating = document.createElement('span');
  rating.textContent = item.vote_average ? item.vote_average.toFixed(1) : '–';
  meta.appendChild(type);
  meta.appendChild(rating);
  info.appendChild(titleEl);
  info.appendChild(meta);
  card.appendChild(info);
  // bookmark
  const bookmark = document.createElement('button');
  bookmark.className = 'bookmark-btn';
  bookmark.innerHTML = '&#9733;';
  const saved = getWatchLater().some((i) => i.id === item.id && i.media_type === item.media_type);
  bookmark.style.color = saved ? '#ffd700' : '#fff';
  bookmark.addEventListener('click', (e) => {
    e.stopPropagation();
    const added = toggleWatchLater({
      id: item.id,
      media_type: item.media_type,
      title: item.title || item.name,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      overview: item.overview,
      vote_average: item.vote_average
    });
    bookmark.style.color = added ? '#ffd700' : '#fff';
  });
  card.appendChild(bookmark);
  // click -> detail page
  card.addEventListener('click', () => {
    const page = item.media_type === 'movie' ? 'movie.html' : 'tv.html';
    window.location.href = `${page}?id=${item.id}`;
  });
  return card;
}

let searchTimeout;

async function handleSearch() {
  const queryInput = document.getElementById('searchQuery');
  const query = queryInput.value.trim();
  const typeFilter = document.querySelector('.filter-btn.active').dataset.type;
  if (!query) {
    document.getElementById('resultsArea').innerHTML = '<p style="margin-top:1rem;">Start typing to search for movies or TV shows.</p>';
    return;
  }
  try {
    const results = await fetchFromTMDB('/search/multi', { query });
    let items = results.results.filter((item) => ['movie', 'tv'].includes(item.media_type));
    if (typeFilter !== 'all') items = items.filter((i) => i.media_type === typeFilter);
    renderResults(items);
  } catch (err) {
    console.error(err);
  }
}

function renderResults(items) {
  const area = document.getElementById('resultsArea');
  area.innerHTML = '';
  if (items.length === 0) {
    area.innerHTML = '<p>No results found.</p>';
    return;
  }
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
  grid.style.gap = '0.8rem';
  items.forEach((item) => grid.appendChild(createCard(item)));
  area.appendChild(grid);
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    // re-run search if query exists
    if (document.getElementById('searchQuery').value.trim()) handleSearch();
  });
});
// Search input
document.getElementById('searchQuery').addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    handleSearch();
  }, 600);
});

// Initialize empty state
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('resultsArea').innerHTML = '<p style="margin-top:1rem;">Start typing to search for movies or TV shows.</p>';
});