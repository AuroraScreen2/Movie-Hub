/*
 * Aurora Movie Hub - Movie Detail Page
 *
 * Responsible for retrieving and displaying detailed information about a single
 * movie from TMDB based on the id provided in the query string. Also fetches
 * credits and recommended movies, enabling users to add the movie to their
 * watch later list and watch via the overlay player.
 */

const API_KEY = 'REPLACE_WITH_YOUR_TMDB_KEY';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const IMG_BACKDROP_URL = 'https://image.tmdb.org/t/p/original';
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
    const stored = localStorage.getItem(WATCH_LATER_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function toggleWatchLater(item) {
  const list = getWatchLater();
  const idx = list.findIndex((i) => i.id === item.id && i.media_type === item.media_type);
  if (idx > -1) {
    list.splice(idx, 1);
  } else {
    list.push(item);
  }
  localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(list));
  return idx === -1;
}

function buildEmbedUrl(type, id) {
  return `https://vidsrc.vercel.app/embed/movie?id=${id}`;
}

function openOverlay(id, type, title) {
  const overlay = document.getElementById('overlayPlayer');
  overlay.classList.add('open');
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-subinfo').textContent = '';
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

function createCastCard(member) {
  const card = document.createElement('div');
  card.className = 'media-card';
  const img = document.createElement('img');
  img.src = member.profile_path ? `${IMG_BASE_URL}${member.profile_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
  img.alt = member.name;
  card.appendChild(img);
  const info = document.createElement('div');
  info.className = 'card-info';
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = member.name;
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const character = document.createElement('span');
  character.textContent = member.character || '';
  meta.appendChild(character);
  info.appendChild(title);
  info.appendChild(meta);
  card.appendChild(info);
  return card;
}

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
  const rating = document.createElement('span');
  rating.textContent = item.vote_average ? item.vote_average.toFixed(1) : '–';
  metaEl.appendChild(document.createTextNode('Movie'));
  metaEl.appendChild(rating);
  info.appendChild(titleEl);
  info.appendChild(metaEl);
  card.appendChild(info);
  // card click
  card.addEventListener('click', () => {
    window.location.href = `movie.html?id=${item.id}`;
  });
  return card;
}

async function loadPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return;
  try {
    const data = await fetchFromTMDB(`/movie/${id}`);
    buildHeader(data);
    buildMetaStrip(data);
    // cast
    const credits = await fetchFromTMDB(`/movie/${id}/credits`);
    const castContainer = document.querySelector('#cast .row-container');
    castContainer.innerHTML = '';
    credits.cast.slice(0, 10).forEach((member) => {
      castContainer.appendChild(createCastCard(member));
    });
    // recommendations
    const rec = await fetchFromTMDB(`/movie/${id}/recommendations`);
    const recContainer = document.querySelector('#recommendedMovies .row-container');
    recContainer.innerHTML = '';
    rec.results.slice(0, 10).forEach((item) => {
      recContainer.appendChild(createMediaCard(item));
    });
  } catch (err) {
    console.error(err);
  }
}

function buildHeader(movie) {
  const header = document.getElementById('movieHeader');
  header.style.display = 'flex';
  header.style.flexWrap = 'wrap';
  header.style.gap = '1rem';
  header.innerHTML = '';
  // poster
  const poster = document.createElement('img');
  poster.src = movie.poster_path ? `${IMG_BASE_URL}${movie.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
  poster.alt = movie.title;
  poster.style.width = '200px';
  poster.style.borderRadius = 'var(--radius)';
  header.appendChild(poster);
  // info
  const info = document.createElement('div');
  info.style.flex = '1';
  const title = document.createElement('h1');
  title.textContent = `${movie.title} (${new Date(movie.release_date).getFullYear() || ''})`;
  const sub = document.createElement('p');
  const runtime = movie.runtime ? `${movie.runtime}m` : '';
  sub.textContent = `${runtime} · Rating ${movie.vote_average.toFixed(1)} · ${movie.genres.map((g) => g.name).join(', ')}`;
  const overview = document.createElement('p');
  overview.textContent = movie.overview;
  overview.style.maxHeight = '4.5em';
  overview.style.overflow = 'hidden';
  overview.style.position = 'relative';
  const showMore = document.createElement('a');
  showMore.textContent = 'Show more';
  showMore.href = 'javascript:void(0)';
  showMore.style.display = 'block';
  showMore.style.marginTop = '0.5rem';
  showMore.addEventListener('click', () => {
    if (overview.style.maxHeight) {
      overview.style.maxHeight = '';
      showMore.textContent = 'Show less';
    } else {
      overview.style.maxHeight = '4.5em';
      showMore.textContent = 'Show more';
    }
  });
  const btnContainer = document.createElement('div');
  btnContainer.style.marginTop = '1rem';
  btnContainer.style.display = 'flex';
  btnContainer.style.gap = '1rem';
  const watchBtn = document.createElement('button');
  watchBtn.className = 'primary';
  watchBtn.textContent = 'Watch';
  watchBtn.addEventListener('click', () => openOverlay(movie.id, 'movie', movie.title));
  const addBtn = document.createElement('button');
  addBtn.className = 'secondary';
  // pre-check
  const saved = getWatchLater().some((i) => i.id === movie.id && i.media_type === 'movie');
  addBtn.textContent = saved ? 'Added' : 'Add to List';
  addBtn.addEventListener('click', () => {
    const added = toggleWatchLater({
      id: movie.id,
      media_type: 'movie',
      title: movie.title,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      overview: movie.overview,
      vote_average: movie.vote_average
    });
    addBtn.textContent = added ? 'Added' : 'Add to List';
  });
  btnContainer.appendChild(watchBtn);
  btnContainer.appendChild(addBtn);
  info.appendChild(title);
  info.appendChild(sub);
  info.appendChild(overview);
  info.appendChild(showMore);
  info.appendChild(btnContainer);
  header.appendChild(info);
}

function buildMetaStrip(movie) {
  const strip = document.getElementById('metaStrip');
  strip.style.display = 'flex';
  strip.style.gap = '2rem';
  strip.style.margin = '1rem 0';
  strip.innerHTML = '';
  const release = document.createElement('span');
  release.textContent = `Released: ${movie.release_date}`;
  const language = document.createElement('span');
  language.textContent = `Language: ${movie.original_language.toUpperCase()}`;
  const status = document.createElement('span');
  status.textContent = `Status: ${movie.status}`;
  if (movie.tagline) {
    const tagline = document.createElement('span');
    tagline.textContent = `"${movie.tagline}"`;
    strip.appendChild(tagline);
  }
  strip.appendChild(release);
  strip.appendChild(language);
  strip.appendChild(status);
}

document.addEventListener('DOMContentLoaded', loadPage);