/* ======== js/movie.js ======== */
/* Page-specific JavaScript for movie.html */

// This file relies on functions from main.js (like fetchApiData, getImageUrl, etc.)

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get the Movie ID from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');

    if (!movieId) {
        // If no ID, show an error and stop
        document.getElementById('movie-details-container').innerHTML = 
            `<h1>Movie not found.</h1>
             <p>Please go back and select a movie.</p>`;
        return;
    }

    // 2. Initialize the page
    initMoviePage(movieId);
});

/**
 * Main function to fetch all data and populate the movie page.
 * @param {string} id - The TMDB movie ID.
 */
async function initMoviePage(id) {
    // 3. Fetch all required data in parallel
    const movieDetailsPromise = fetchApiData(TMDB_CONFIG.endpoints.movieDetails + id);
    const movieCreditsPromise = fetchApiData(TMDB_CONFIG.endpoints.movieDetails + id + '/credits');
    const movieRecsPromise = fetchApiData(TMDB_CONFIG.endpoints.movieDetails + id + '/recommendations');

    const [movieData, creditsData, recsData] = await Promise.all([
        movieDetailsPromise,
        movieCreditsPromise,
        movieRecsPromise
    ]);

    // 4. Check for valid data
    if (!movieData) {
        document.getElementById('movie-details-container').innerHTML = `<h1>Error loading movie details.</h1>`;
        return;
    }

    // 5. Populate the page components
    populateMovieHeader(movieData);
    
    if (creditsData && creditsData.cast) {
        populateCast(creditsData.cast);
    }

    if (recsData && recsData.results) {
        populateRecommendations(recsData.results);
    }

    // 6. Update Watch Later button state
    // We need to wait a tiny bit for the button to be added to the DOM
    setTimeout(() => {
        const addBtn = document.querySelector('#movie-details-container .btn-add-list');
        if (addBtn) {
            updateWatchLaterButtonUI(addBtn, parseInt(id));
        }
        
        // Also update all recommendation card buttons
        updateAllWatchLaterButtons();
    }, 100);

    // 7. Add page-specific event listener for the main "Watch" button
    const watchButton = document.querySelector('.btn-watch-movie');
    if (watchButton) {
        watchButton.addEventListener('click', () => {
            const { id, type } = watchButton.dataset;
            openPlayer(id, type);
        });
    }
}

/**
 * Builds the HTML for the main movie header section.
 * @param {Object} movie - The full movie data object from TMDB.
 */
function populateMovieHeader(movie) {
    const container = document.getElementById('movie-details-container');
    
    // Format data
    const backdropUrl = getImageUrl(movie.backdrop_path, 'original');
    const posterUrl = getImageUrl(movie.poster_path, 'w500');
    const title = movie.title || movie.name;
    const year = movie.release_date ? `(${movie.release_date.substring(0, 4)})` : '';
    const rating = formatRating(movie.vote_average);
    const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '';
    const genres = movie.genres.map(g => g.name).join(', ');
    const language = movie.original_language ? new Intl.DisplayNames(['en'], { type: 'language' }).of(movie.original_language) : 'N/A';

    // Data for the Watch Later button
    const itemData = {
        id: movie.id,
        type: 'movie',
        title: title,
        poster: movie.poster_path,
        overview: movie.overview,
        rating: movie.vote_average
    };

    const headerHTML = `
        <div class="movie-header-area" style="background-image: url(${backdropUrl});">
            <div class="header-gradient-overlay"></div>
            <div class="movie-header-content">
                
                <div class="movie-poster-container">
                    <img id="movie-poster" src="${posterUrl}" alt="${title}">
                </div>

                <div class="movie-info-container">
                    <h1 id="movie-title">${title} ${year}</h1>
                    <div class="movie-meta-info" id="movie-meta-info">
                        <span class="badge badge-rating">${rating}</span>
                        ${runtime ? `<span class="meta-item" id="movie-runtime">${runtime}</span>` : ''}
                        ${genres ? `<span class="meta-item" id="movie-genres">${genres}</span>` : ''}
                    </div>
                    ${movie.tagline ? `<p class="movie-tagline" id="movie-tagline">${movie.tagline}</p>` : ''}
                    <p class="movie-overview" id="movie-overview">
                        ${movie.overview}
                    </p>
                    <div class="movie-buttons">
                        <button class="btn btn-primary btn-watch-movie" data-id="${movie.id}" data-type="movie">
                            <span class="material-icons-outlined">play_arrow</span>
                            Watch Now
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

        <div class="movie-meta-strip" id="movie-meta-strip">
            <div class="meta-strip-item">
                <strong>Status</strong>
                <span id="meta-status">${movie.status}</span>
            </div>
            <div class="meta-strip-item">
                <strong>Release Date</strong>
                <span id="meta-release-date">${movie.release_date}</span>
            </div>
            <div class="meta-strip-item">
                <strong>Original Language</strong>
                <span id="meta-language">${language}</span>
            </div>
        </div>
    `;
    
    container.innerHTML = headerHTML;
}

/**
 * Builds the HTML for the cast scroller.
 * @param {Array<Object>} cast - The cast array from the API.
 */
function populateCast(cast) {
    const container = document.getElementById('cast-scroller');
    if (!container) return;
    
    // Get top 15 cast members
    const mainCast = cast.slice(0, 15);
    container.innerHTML = ''; // Clear

    mainCast.forEach(member => {
        const card = document.createElement('div');
        card.className = 'cast-card';
        
        const profileUrl = getImageUrl(member.profile_path, 'w500');
        
        card.innerHTML = `
            <div class="cast-poster">
                <img src="${profileUrl}" alt="${member.name}" loading="lazy">
            </div>
            <span class="actor-name">${member.name}</span>
            <span class="character-name">${member.character}</span>
        `;
        container.appendChild(card);
    });
}

/**
 * Builds the HTML for the recommendations scroller.
 * @param {Array<Object>} recommendations - The results array from the API.
 */
function populateRecommendations(recommendations) {
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
