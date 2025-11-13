/* ======== js/tv.js ======== */
/* Page-specific JavaScript for tv.html */

// Relies on functions from main.js (fetchApiData, getImageUrl, etc.)

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get the TV Show ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const tvId = urlParams.get('id');

    if (!tvId) {
        // If no ID, show an error and stop
        document.getElementById('tv-details-container').innerHTML = 
            `<h1>Show not found.</h1>
             <p>Please go back and select a TV show.</p>`;
        return;
    }

    // 2. Initialize the page
    initTvPage(tvId);
});

/**
 * Main function to fetch all data and populate the TV page.
 * @param {string} id - The TMDB TV show ID.
 */
async function initTvPage(id) {
    // 3. Fetch show details and recommendations in parallel
    const detailsPromise = fetchApiData(TMDB_CONFIG.endpoints.tvDetails + id);
    const recsPromise = fetchApiData(TMDB_CONFIG.endpoints.tvDetails + id + '/recommendations');

    const [showData, recsData] = await Promise.all([detailsPromise, recsPromise]);

    // 4. Check for valid data
    if (!showData) {
        document.getElementById('tv-details-container').innerHTML = `<h1>Error loading show details.</h1>`;
        return;
    }

    // 5. Populate the page components
    populateTvHeader(showData);
    populateSeasonSelector(showData.seasons, id);

    // 6. Fetch and populate episodes for the *first* available season
    // (Often Season 1, but we find the first non-zero season number)
    const firstSeason = showData.seasons.find(s => s.season_number > 0) || showData.seasons[0];
    if (firstSeason) {
        fetchAndPopulateEpisodes(id, firstSeason.season_number);
    }

    // 7. Populate recommendations row
    if (recsData && recsData.results) {
        populateTvRecommendations(recsData.results);
    }

    // 8. Update Watch Later button state
    setTimeout(() => {
        const addBtn = document.querySelector('#tv-details-container .btn-add-list');
        if (addBtn) {
            updateWatchLaterButtonUI(addBtn, parseInt(id));
        }
        updateAllWatchLaterButtons(); // For recommendation cards
    }, 100);

    // 9. Add page-specific "Watch" button listener
    const watchButton = document.querySelector('.btn-watch-tv');
    if (watchButton) {
        watchButton.addEventListener('click', () => {
            const firstSeasonNum = firstSeason ? firstSeason.season_number : 1;
            // Open player for Season 1, Episode 1
            openPlayer(id, 'tv', firstSeasonNum, 1);
        });
    }
}

/**
 * Builds the HTML for the main TV show header section.
 * @param {Object} show - The full TV show data object from TMDB.
 */
function populateTvHeader(show) {
    const container = document.getElementById('tv-details-container');

    // Format data
    const backdropUrl = getImageUrl(show.backdrop_path, 'original');
    const posterUrl = getImageUrl(show.poster_path, 'w500');
    const title = show.name;
    const year = show.first_air_date ? `(${show.first_air_date.substring(0, 4)})` : '';
    const rating = formatRating(show.vote_average);
    const seasons = `${show.number_of_seasons} ${show.number_of_seasons > 1 ? 'Seasons' : 'Season'}`;
    const status = show.status;
    const genres = show.genres.map(g => g.name).join(', ');

    // Data for the Watch Later button
    const itemData = {
        id: show.id,
        type: 'tv',
        title: title,
        poster: show.poster_path,
        overview: show.overview,
        rating: show.vote_average
    };

    const headerHTML = `
        <div class="movie-header-area" style="background-image: url(${backdropUrl});">
            <div class="header-gradient-overlay"></div>
            <div class="movie-header-content">
                
                <div class="movie-poster-container">
                    <img id="tv-poster" src="${posterUrl}" alt="${title}">
                </div>

                <div class="movie-info-container">
                    <h1 id="tv-title">${title} ${year}</h1>
                    <div class="movie-meta-info" id="tv-meta-info">
                        <span class="badge badge-rating">${rating}</span>
                        <span class="meta-item" id="tv-seasons">${seasons}</span>
                        <span class="meta-item" id="tv-status">${status}</span>
                        <span class="meta-item" id="tv-genres">${genres}</span>
                    </div>
                    <p class="movie-overview" id="tv-overview">${show.overview}</p>
                    <div class="movie-buttons">
                        <button class="btn btn-primary btn-watch-tv" data-id="${show.id}" data-type="tv">
                            <span class="material-icons-outlined">play_arrow</span>
                            Watch First Episode
                        </button>
                        <button class="btn btn-icon btn-secondary btn-add-list" 
                            aria-label="Add to Watch Later"
                            data-id="${itemData.id}"
                            data-type="${itemData.type}"
                            data-title="${escape(itemData.title)}"
                            data-poster="${itemData.poster || ''}"
                            data-overview="${escape(itemData.overview)}"
                            data-rating="${itemData.rating}">
                            <span class="material-icons-outlined">bookmark_border</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = headerHTML;
}

/**
 * Populates the season selector pills/buttons.
 * @param {Array<Object>} seasons - The seasons array from the show data.
 * @param {string} tvId - The TMDB TV show ID.
 */
function populateSeasonSelector(seasons, tvId) {
    const container = document.getElementById('season-selector');
    if (!container) return;

    container.innerHTML = ''; // Clear
    let isFirstActiveSeason = false;

    seasons.forEach(season => {
        const pill = document.createElement('button');
        pill.className = 'season-pill';
        pill.dataset.season = season.season_number;
        pill.textContent = season.name; // e.g., "Season 1"

        // Make the first "real" season (not "Specials") active by default
        if (!isFirstActiveSeason && season.season_number > 0) {
            pill.classList.add('active');
            isFirstActiveSeason = true;
        }

        // Add click listener to fetch this season's episodes
        pill.addEventListener('click', () => {
            // Remove 'active' from all other pills
            document.querySelectorAll('.season-pill.active').forEach(btn => btn.classList.remove('active'));
            // Add 'active' to the clicked pill
            pill.classList.add('active');
            // Fetch and display episodes
            fetchAndPopulateEpisodes(tvId, season.season_number);
        });

        container.appendChild(pill);
    });

    // Handle edge case: if only "Specials" (Season 0) exists
    if (!isFirstActiveSeason && container.firstChild) {
        container.firstChild.classList.add('active');
    }
}

/**
 * Fetches episode data for a specific season and populates the grid.
 * @param {string} tvId - The TMDB TV show ID.
 * @param {number} seasonNumber - The season number to fetch.
 */
async function fetchAndPopulateEpisodes(tvId, seasonNumber) {
    const grid = document.getElementById('episode-grid');
    if (!grid) return;

    // Show loading state
    grid.innerHTML = `<p class="loading-episodes">Loading episodes...</p>`;

    const seasonData = await fetchApiData(`/tv/${tvId}/season/${seasonNumber}`);

    if (!seasonData || !seasonData.episodes || seasonData.episodes.length === 0) {
        grid.innerHTML = `<p>No episodes found for this season.</p>`;
        return;
    }

    grid.innerHTML = ''; // Clear loading state

    seasonData.episodes.forEach(episode => {
        const card = document.createElement('div');
        card.className = 'episode-card';
        // Add data attributes to be used by the player
        card.dataset.id = tvId;
        card.dataset.season = seasonNumber;
        card.dataset.episode = episode.episode_number;

        // Format data
        const stillUrl = getImageUrl(episode.still_path, 'w500');
        const title = `${episode.episode_number}. ${episode.name}`;
        const overview = episode.overview || "No description available.";
        const runtime = episode.runtime ? `${episode.runtime}m` : '';

        card.innerHTML = `
            <div class="episode-thumbnail-container">
                <img class="episode-thumbnail" src="${stillUrl}" alt="${title}" loading="lazy">
                <button class="episode-play-btn" aria-label="Play episode">
                    <span class="material-icons-outlined">play_arrow</span>
                </button>
            </div>
            <div class="episode-info">
                <h3 class="episode-title">${title}</h3>
                <p class="episode-overview">${overview}</p>
            </div>
            ${runtime ? `<span class="episode-meta">${runtime}</span>` : ''}
        `;

        // Add click listener to the card itself to open the player
        card.addEventListener('click', () => {
            openPlayer(tvId, 'tv', seasonNumber, episode.episode_number);
        });

        grid.appendChild(card);
    });
}

/**
 * Builds the HTML for the recommendations scroller.
 * @param {Array<Object>} recommendations - The results array from the API.
 */
function populateTvRecommendations(recommendations) {
    const container = document.getElementById('recommended-scroller');
    if (!container) return;

    container.innerHTML = ''; // Clear

    recommendations
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv') // Ensure it's media
        .forEach(item => {
            // We can reuse the createMediaCard function from main.js!
            const card = createMediaCard(item);
            container.appendChild(card);
        });
}
