/*
 * Aurora Movie Hub - Watch Later Page
 *
 * Presents the user’s watch‑later list stored in localStorage. Items can be
 * filtered by type (movies, TV), removed individually or watched directly
 * through the overlay player. The subtext displays the count of saved items.
 */

const WATCH_LATER_KEY = 'watchLaterItems';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';

function getWatchLater() {
  try {
    return JSON.parse(localStorage.getItem(WATCH_LATER_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveWatchLater(list) {
  localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(list));
}

function buildEmbedUrl(item) {
  return item.media_type === 'movie'
    ? `https://vidsrc.vercel.app/embed/movie?id=${item.id}`
    : `https://vidsrc.vercel.app/embed/tv?id=${item.id}&season=1&episode=1`;
}

function openOverlay(item) {
  const overlay = document.getElementById('overlayPlayer');
  overlay.classList.add('open');
  document.getElementById('overlay-title').textContent = item.title;
  document.getElementById('overlay-iframe').src = buildEmbedUrl(item);
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
  img.alt = item.title;
  card.appendChild(img);
  const info = document.createElement('div');
  info.className = 'card-info';
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = item.title;
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const type = document.createElement('span');
  type.textContent = item.media_type === 'movie' ? 'Movie' : 'TV';
  const rating = document.createElement('span');
  rating.textContent = item.vote_average ? item.vote_average.toFixed(1) : '–';
  meta.appendChild(type);
  meta.appendChild(rating);
  info.appendChild(title);
  info.appendChild(meta);
  card.appendChild(info);
  // remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'bookmark-btn';
  removeBtn.innerHTML = '&times;';
  removeBtn.title = 'Remove from list';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const list = getWatchLater();
    const idx = list.findIndex((i) => i.id === item.id && i.media_type === item.media_type);
    if (idx > -1) {
      list.splice(idx, 1);
      saveWatchLater(list);
      renderList(currentFilter);
    }
  });
  card.appendChild(removeBtn);
  // click -> detail page
  card.addEventListener('click', () => {
    const page = item.media_type === 'movie' ? 'movie.html' : 'tv.html';
    window.location.href = `${page}?id=${item.id}`;
  });
  return card;
}

let currentFilter = 'all';

function renderList(filterType) {
  const list = getWatchLater();
  const filtered = filterType === 'all' ? list : list.filter((i) => i.media_type === filterType);
  const subtext = document.getElementById('subtext');
  subtext.textContent = `${list.length} item${list.length !== 1 ? 's' : ''} saved`;
  const container = document.getElementById('itemsList');
  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<p>Your watch later list is empty.</p>';
    return;
  }
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
  grid.style.gap = '0.8rem';
  filtered.forEach((item) => {
    grid.appendChild(createCard(item));
  });
  container.appendChild(grid);
}

document.querySelectorAll('#filterBar .filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filterBar .filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.type;
    renderList(currentFilter);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  renderList(currentFilter);
});