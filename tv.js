/*
 * Aurora Movie Hub - TV Detail Page
 *
 * Handles fetching and displaying TV show information, seasons, episodes and
 * recommendations from TMDB. Supports watching episodes via overlay and
 * remembers last watched episode in localStorage.
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
    const stored = localStorage.getItem(WATCH_LATER_KEY);
    return stored ? JSON.parse(stored) : [];
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

function buildEmbedUrl(id, season, episode) {
  return `https://vidsrc.vercel.app/embed/tv?id=${id}&season=${season}&episode=${episode}`;
}
function openOverlay(id, season, episode, title) {
  const overlay = document.getElementById('overlayPlayer');
  overlay.classList.add('open');
  document.getElementById('overlay-title').textContent = `${title} - S${season}E${episode}`;
  document.getElementById('overlay-iframe').src = buildEmbedUrl(id, season, episode);
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

function createMediaCard(item) {
  const card = document.createElement('div');
  card.className = 'media-card';
  const img = document.createElement('img');
  img.src = item.poster_path ? `${IMG_BASE_URL}${item.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
  img.alt = item.name;
  card.appendChild(img);
  const info = document.createElement('div');
  info.className = 'card-info';
  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  titleEl.textContent = item.name;
  const metaEl = document.createElement('div');
  metaEl.className = 'card-meta';
  const rating = document.createElement('span');
  rating.textContent = item.vote_average ? item.vote_average.toFixed(1) : '–';
  metaEl.appendChild(document.createTextNode('TV'));
  metaEl.appendChild(rating);
  info.appendChild(titleEl);
  info.appendChild(metaEl);
  card.appendChild(info);
  card.addEventListener('click', () => {
    window.location.href = `tv.html?id=${item.id}`;
  });
  return card;
}

function getLastWatchedKey(showId, seasonNumber) {
  return `lastSelectedEpisode_${showId}_${seasonNumber}`;
}

async function loadPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return;
  try {
    const show = await fetchFromTMDB(`/tv/${id}`);
    buildHeader(show);
    buildSeasonSelector(show);
    loadSeason(id, 1, show.name);
    // recommendations
    const rec = await fetchFromTMDB(`/tv/${id}/recommendations`);
    const recContainer = document.querySelector('#recommendedTV .row-container');
    recContainer.innerHTML = '';
    rec.results.slice(0, 10).forEach((item) => {
      recContainer.appendChild(createMediaCard(item));
    });
  } catch (err) {
    console.error(err);
  }
}

function buildHeader(show) {
  const header = document.getElementById('tvHeader');
  header.style.display = 'flex';
  header.style.flexWrap = 'wrap';
  header.style.gap = '1rem';
  header.innerHTML = '';
  const poster = document.createElement('img');
  poster.src = show.poster_path ? `${IMG_BASE_URL}${show.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
  poster.alt = show.name;
  poster.style.width = '200px';
  poster.style.borderRadius = 'var(--radius)';
  header.appendChild(poster);
  const info = document.createElement('div');
  info.style.flex = '1';
  const title = document.createElement('h1');
  title.textContent = `${show.name}`;
  const sub = document.createElement('p');
  sub.textContent = `${show.number_of_seasons} seasons · ${show.status} · ${show.genres.map((g) => g.name).join(', ')}`;
  const overview = document.createElement('p');
  overview.textContent = show.overview;
  overview.style.maxHeight = '4.5em';
  overview.style.overflow = 'hidden';
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
  watchBtn.addEventListener('click', () => {
    // watch last or first episode of season 1
    const key = getLastWatchedKey(show.id, 1);
    const last = JSON.parse(localStorage.getItem(key) || '{}');
    const episode = last.episode || 1;
    openOverlay(show.id, 1, episode, show.name);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'secondary';
  const saved = getWatchLater().some((i) => i.id === show.id && i.media_type === 'tv');
  addBtn.textContent = saved ? 'Added' : 'Add to List';
  addBtn.addEventListener('click', () => {
    const added = toggleWatchLater({
      id: show.id,
      media_type: 'tv',
      title: show.name,
      poster_path: show.poster_path,
      backdrop_path: show.backdrop_path,
      overview: show.overview,
      vote_average: show.vote_average
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

function buildSeasonSelector(show) {
  const container = document.getElementById('seasonSelector');
  container.style.display = 'flex';
  container.style.gap = '0.5rem';
  container.style.margin = '1rem 0';
  container.innerHTML = '';
  show.seasons.forEach((season) => {
    if (season.season_number === 0) return; // skip specials
    const btn = document.createElement('button');
    btn.textContent = `Season ${season.season_number}`;
    btn.className = 'secondary';
    btn.addEventListener('click', () => {
      // highlight active
      document.querySelectorAll('#seasonSelector button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadSeason(show.id, season.season_number, show.name);
    });
    // highlight first by default
    if (season.season_number === 1) btn.classList.add('active');
    container.appendChild(btn);
  });
}

async function loadSeason(showId, seasonNumber, showName) {
  try {
    const seasonData = await fetchFromTMDB(`/tv/${showId}/season/${seasonNumber}`);
    const grid = document.getElementById('episodeGrid');
    grid.innerHTML = '';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    grid.style.gap = '1rem';
    seasonData.episodes.forEach((ep) => {
      const card = document.createElement('div');
      card.className = 'media-card';
      const img = document.createElement('img');
      img.src = ep.still_path ? `${IMG_BASE_URL}${ep.still_path}` : 'https://via.placeholder.com/500x281?text=No+Image';
      img.alt = ep.name;
      card.appendChild(img);
      const info = document.createElement('div');
      info.className = 'card-info';
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = `E${ep.episode_number}: ${ep.name}`;
      const meta = document.createElement('div');
      meta.className = 'card-meta';
      const runtime = document.createElement('span');
      runtime.textContent = ep.runtime ? `${ep.runtime}m` : '';
      const airDate = document.createElement('span');
      airDate.textContent = ep.air_date ? ep.air_date : '';
      meta.appendChild(runtime);
      meta.appendChild(airDate);
      info.appendChild(title);
      info.appendChild(meta);
      card.appendChild(info);
      card.addEventListener('click', () => {
        // store last watched
        localStorage.setItem(getLastWatchedKey(showId, seasonNumber), JSON.stringify({
          episode: ep.episode_number,
          name: ep.name
        }));
        openOverlay(showId, seasonNumber, ep.episode_number, showName);
      });
      // highlight last watched
      const last = JSON.parse(localStorage.getItem(getLastWatchedKey(showId, seasonNumber)) || '{}');
      if (last.episode === ep.episode_number) {
        card.style.outline = `2px solid var(--accent)`;
      }
      grid.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', loadPage);