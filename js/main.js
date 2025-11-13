/* ======== js/main.js ======== */
/* Main JavaScript for StreamVerse */

/**
 * TABLE OF CONTENTS
 * 1. CONFIGURATION & STATE
 * 2. API HELPERS
 * 3. DOMContentLoaded (Initialization)
 * 4. EVENT LISTENERS
 * 5. HERO CAROUSEL LOGIC
 * 6. DATA FETCHING & POPULATION
 * 7. HTML COMPONENT BUILDERS
 * 8. OVERLAY PLAYER LOGIC
 * 9. WATCH LATER (localStorage) LOGIC
 * 10. UTILITY FUNCTIONS
 */

// ======== 1. CONFIGURATION & STATE ========

// !!! IMPORTANT: Add your TMDB API Key here
const API_KEY = 'b29bfe548cc2a3e4225effbd54ef0fda'; // Get one from themoviedb.org
// If you don't have one, the app will not fetch data.

const TMDB_CONFIG = {
    baseUrl: "https://api.themoviedb.org/3",
    imageBaseUrl: "https://image.tmdb.org/t/p",
    apiKey: `api_key=${API_KEY}`,
    endpoints: {
        trendingAll: "/trending/all/week",
        trendingMovies: "/trending/movie/week",
        trendingTV: "/trending/tv/week",
        topRatedMovies: "/movie/top_rated",
        topRatedTV: "/tv/top_rated",
        movieDetails: "/movie/", // Requires {id}
        tvDetails: "/tv/", // Requires {id}
        tvSeason: "/tv/{id}/season/{season_number}",
        movieVideos: "/movie/{id}/videos",
        searchMulti: "/search/multi",
    }
};

// Global state for hero carousel
let heroCarousel;
let heroSlides = [];
let currentHeroIndex = 0;
let heroInterval;


// ======== 2. API HELPERS ========

/**
 * A reusable function to fetch data from the TMDB API.
 * @param {string} endpoint - The API endpoint (e.g., TMDB_CONFIG.endpoints.trendingMovies).
 * @param {string} [params=""] - Optional query parameters (e.g., "&page=2").
 * @returns {Promise<Object|null>} - The JSON data from the API or null on error.
 */
async function fetchApiData(endpoint, params = "") {
    const url = `${TMDB_CONFIG.baseUrl}${endpoint}?${TMDB_CONFIG.apiKey}${params}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`API Error: ${response.status} ${response.statusText} for URL: ${url}`);
            return null;
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Failed to fetch from ${url}:`, error);
        return null;
    }
}

/**
 * Builds the full URL for a TMDB image.
 * @param {string} path - The path from the API (e.g., /w500/path.jpg).
 * @param {string} [size="w500"] - The image size (e.g., "w500", "w780", "original").
 * @returns {string} The full image URL.
 */
function getImageUrl(path, size = "w500") {
    return path ? `${TMDB_CONFIG.imageBaseUrl}/${size}${path}` : 'https://via.placeholder.com/500x750.png?text=No+Image';
}


// ======== 3. DOMContentLoaded (Initialization) ========

/**
 * Fires when the initial HTML document has been completely loaded and parsed.
 * This is the main entry point for our JavaScript.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Add scroll event for header styling
    window.addEventListener('scroll', handleHeaderScroll);
    
    // Initialize based on which page we are on
    const page = document.body.id || 'page-index'; // We will add body IDs later
    
    // For now, assume we are on index.html
    if (page === 'page-index' || !document.body.id) {
        initIndexPage();
    }
    // else if (page === 'page-movie') { initMoviePage(); }
    // else if (page === 'page-tv') { initTvPage(); }
    // else if (page === 'page-watch-later') { initWatchLaterPage(); }

    // Initialize all global event listeners
    initGlobalListeners();
});

/**
 * Initializes all functionality for the Index Page.
 */
async function initIndexPage() {
    // Fetch data and populate the hero carousel
    const trendingData = await fetchApiData(TMDB_CONFIG.endpoints.trendingAll, "&language=en-US&page=1");
    if (trendingData && trendingData.results) {
        // Filter out people, only get movies and TV shows
        heroSlides = trendingData.results
            .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
            .slice(0, 5); // Get top 5
        populateHeroCarousel(heroSlides);
    }

    // Fetch and populate media rows
    populateMediaRow('#trending-movies-scroller', TMDB_CONFIG.endpoints.trendingMovies);
    populateMediaRow('#trending-tv-scroller', TMDB_CONFIG.endpoints.trendingTV);
    
    // For Top Rated, we fetch both and mix them
    populateTopRatedRow('#top-rated-scroller');
}


// ======== 4. EVENT LISTENERS ========

/**
 * Adds global event listeners that are needed on every page.
 */
function initGlobalListeners() {
    // Get the overlay player elements
    const overlay = document.getElementById('overlayPlayer');
    const closeBtn = overlay.querySelector('.overlay-close-btn');
    const backdrop = overlay.querySelector('.overlay-backdrop');

    // Close overlay player
    closeBtn.addEventListener('click', closePlayer);
    backdrop.addEventListener('click', closePlayer);

    // This is the most important listener. It listens for clicks on the *whole document*.
    // We then check *what* was clicked and act accordingly.
    // This is "Event Delegation".
    document.body.addEventListener('click', (e) => {
        
        // --- WATCH LATER ---
        // Check if the click was on a 'btn-add-list' or its child
        const addListButton = e.target.closest('.btn-add-list');
        if (addListButton) {
            e.preventDefault(); // Prevent link navigation if it's inside an <a>
            const { id, type, title, poster, overview, rating } = addListButton.dataset;
            const itemData = {
                id: parseInt(id),
                type,
                title,
                poster_path: poster,
                overview,
                vote_average: parseFloat(rating)
            };
            toggleWatchLater(itemData.id, itemData);
            updateWatchLaterButtonUI(addListButton, itemData.id); // Update this specific button
            return; // Stop processing the click
        }

        // --- OPEN PLAYER ---
        // Check if the click was on a 'btn-watch-hero'
        const watchHeroButton = e.target.closest('.btn-watch-hero');
        if (watchHeroButton) {
            e.preventDefault();
            const { id, type } = watchHeroButton.dataset;
            openPlayer(id, type);
            return;
        }
        
        // Add more watch button listeners here as needed (e.g., from cards)
        // const watchCardButton = e.target.closest('.btn-watch-card');
        // if (watchCardButton) { ... }
    });
}

/**
 * Handles adding a 'scrolled' class to the header for styling.
 */
function handleHeaderScroll() {
    const header = document.querySelector('.main-header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
}


// ======== 5. HERO CAROUSEL LOGIC ========

/**
 * Populates the hero carousel with data.
 * @param {Array<Object>} items - Array of movie/tv items from API.
 */
function populateHeroCarousel(items) {
    const carouselContainer = document.getElementById('hero-carousel');
    const dotsContainer = document.getElementById('hero-dots');
    if (!carouselContainer || !dotsContainer) return;

    // Clear any existing content
    carouselContainer.innerHTML = '';
    dotsContainer.innerHTML = '';

    items.forEach((item, index) => {
        const slide = createHeroSlide(item);
        if (index === 0) {
            slide.classList.add('active'); // Make first slide active
        }
        carouselContainer.appendChild(slide);

        // Create a dot
        const dot = document.createElement('button');
        dot.classList.add('carousel-dot');
        if (index === 0) {
            dot.classList.add('active');
        }
        dot.dataset.index = index;
        dot.ariaLabel = `Go to slide ${index + 1}`;
        dot.addEventListener('click', () => showHeroSlide(index));
        dotsContainer.appendChild(dot);
    });

    // Add navigation listeners
    document.getElementById('hero-prev').addEventListener('click', prevHeroSlide);
    document.getElementById('hero-next').addEventListener('click', nextHeroSlide);

    // Start auto-rotate
    startHeroInterval();
}

/**
 * Shows a specific slide by its index.
 * @param {number} index - The index of the slide to show.
 */
function showHeroSlide(index) {
    const slides = document.querySelectorAll('#hero-carousel .hero-slide');
    const dots = document.querySelectorAll('#hero-dots .carousel-dot');

    // Clamp index to valid range
    if (index >= slides.length) {
        index = 0;
    } else if (index < 0) {
        index = slides.length - 1;
    }

    // Remove active class from all
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    // Add active class to current
    slides[index].classList.add('active');
    dots[index].classList.add('active');

    currentHeroIndex = index;
    
    // Reset auto-rotate timer
    startHeroInterval();
}

function nextHeroSlide() {
    showHeroSlide(currentHeroIndex + 1);
}

function prevHeroSlide() {
    showHeroSlide(currentHeroIndex - 1);
}

function startHeroInterval() {
    clearInterval(heroInterval); // Clear existing timer
    heroInterval = setInterval(nextHeroSlide, 7000); // Change slide every 7 seconds
}


// ======== 6. DATA FETCHING & POPULATION ========

/**
 * Fetches data for a media row and populates it.
 * @param {string} containerSelector - The CSS selector for the row's scroller.
 * @param {string} endpoint - The TMDB API endpoint to fetch from.
 */
async function populateMediaRow(containerSelector, endpoint) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const data = await fetchApiData(endpoint);
    if (!data || !data.results) {
        container.innerHTML = "<p>Could not load content.</p>";
        return;
    }

    container.innerHTML = ''; // Clear loading/placeholder
    data.results.forEach(item => {
        // API doesn't always include 'media_type' if endpoint is specific
        // We must add it for our components to work
        if (endpoint === TMDB_CONFIG.endpoints.trendingMovies) item.media_type = 'movie';
        if (endpoint === TMDB_CONFIG.endpoints.trendingTV) item.media_type = 'tv';
        
        const card = createMediaCard(item);
        container.appendChild(card);
    });
    
    // After all cards are added, update their "Watch Later" button state
    updateAllWatchLaterButtons();
}

/**
 * Special function to populate the "Top Rated" row by mixing movies and TV.
 * @param {string} containerSelector - The CSS selector for the row's scroller.
 */
async function populateTopRatedRow(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    // Fetch both movies and TV shows
    const moviesPromise = fetchApiData(TMDB_CONFIG.endpoints.topRatedMovies);
    const tvPromise = fetchApiData(TMDB_CONFIG.endpoints.topRatedTV);
    
    const [movieData, tvData] = await Promise.all([moviesPromise, tvPromise]);

    let mixedResults = [];
    if (movieData && movieData.results) {
        movieData.results.forEach(item => item.media_type = 'movie');
        mixedResults.push(...movieData.results);
    }
    if (tvData && tvData.results) {
        tvData.results.forEach(item => item.media_type = 'tv');
        mixedResults.push(...tvData.results);
    }

    // Sort the mixed list by popularity (or vote_average, but popularity is more dynamic)
    mixedResults.sort((a, b) => b.popularity - a.popularity);
    
    // Take the top 20
    const finalResults = mixedResults.slice(0, 20);

    container.innerHTML = ''; // Clear
    finalResults.forEach(item => {
        const card = createMediaCard(item);
        container.appendChild(card);
    });
    
    updateAllWatchLaterButtons();
}


// ======== 7. HTML COMPONENT BUILDERS ========

/**
 * Creates the HTML for a single Hero Slide.
 * @param {Object} item - The movie/tv item from API.
 * @returns {HTMLElement} A DOM element representing the slide.
 */
function createHeroSlide(item) {
    const slide = document.createElement('div');
    slide.className = 'hero-slide';
    
    const backdropUrl = getImageUrl(item.backdrop_path, 'original');
    slide.style.backgroundImage = `url(${backdropUrl})`;
    
    const type = item.media_type === 'tv' ? 'TV' : 'Movie';
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const year = releaseDate ? releaseDate.substring(0, 4) : 'N/A';
    const rating = formatRating(item.vote_average);
    
    // Data for Watch Later button
    const itemData = {
        id: item.id,
        type: item.media_type,
        title: title,
        poster: item.poster_path,
        overview: item.overview,
        rating: item.vote_average
    };

    slide.innerHTML = `
        <div class="hero-gradient-overlay"></div>
        <div class="hero-content">
            <h1 class="hero-title">${title}</h1>
            <div class="hero-meta">
                <span class="badge badge-type">${type}</span>
                <span class="badge badge-rating">${rating}</span>
                <span class="badge badge-year">${year}</span>
            </div>
            <p class="hero-overview">${item.overview}</p>
            <div class="hero-buttons">
                <button class="btn btn-primary btn-watch-hero" data-id="${item.id}" data-type="${item.media_type}">
                    <span class="material-icons-outlined">play_arrow</span>
                    Watch
                </button>
                <a href="${item.media_type}.html?id=${item.id}" class="btn btn-secondary">
                    <span class="material-icons-outlined">info</span>
                    More Info
                </a>
                <button class="btn btn-icon btn-secondary btn-add-list" 
                    aria-label="Add to Watch Later"
                    data-id="${item.id}"
                    data-type="${item.media_type}"
                    data-title="${escape(title)}"
                    data-poster="${item.poster_path || ''}"
                    data-overview="${escape(item.overview)}"
                    data-rating="${item.vote_average}">
                    <span class="material-icons-outlined">bookmark_border</span>
                </button>
            </div>
        </div>
    `;
    return slide;
}

/**
 * Creates the HTML for a single Media Card.
 * @param {Object} item - The movie/tv item from API.
 * @returns {HTMLElement} A DOM element representing the card.
 */
function createMediaCard(item) {
    const card = document.createElement('div');
    card.className = 'media-card';
    
    const type = item.media_type === 'tv' ? 'TV' : 'Movie';
    const title = item.title || item.name;
    const posterUrl = getImageUrl(item.poster_path, 'w500');
    const rating = formatRating(item.vote_average);
    
    // Data for Watch Later button
    const itemData = {
        id: item.id,
        type: item.media_type,
        title: title,
        poster: item.poster_path,
        overview: item.overview,
        rating: item.vote_average
    };

    card.innerHTML = `
        <a href="${item.media_type}.html?id=${item.id}" class="card-link">
            <div class="card-poster">
                <img src="${posterUrl}" alt="${title}" loading="lazy">
                <span class="badge badge-type-card">${type}</span>
                <span class="badge badge-rating-card">${rating}</span>
            </div>
            <h3 class="card-title">${title}</h3>
        </a>
        <button class="btn-icon card-add-btn btn-add-list" 
            aria-label="Add to Watch Later"
            data-id="${item.id}"
            data-type="${item.media_type}"
            data-title="${escape(title)}"
            data-poster="${item.poster_path || ''}"
            data-overview="${escape(item.overview)}"
            data-rating="${item.vote_average}">
            <span class="material-icons-outlined">bookmark_border</span>
        </button>
    `;
    return card;
}


// ======== 8. OVERLAY PLAYER LOGIC ========

const overlay = document.getElementById('overlayPlayer');

/**
 * Opens the overlay player and fetches the correct media.
 * @param {string} id - The TMDB ID of the movie or TV show.
 * @param {string} type - 'movie' or 'tv'.
 * @param {string} [season] - Optional season number for TV.
 * @param {string} [episode] - Optional episode number for TV.
 */
async function openPlayer(id, type, season, episode) {
    // 1. Show the overlay
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // 2. Clear previous content
    const titleEl = document.getElementById('overlay-title');
    const iframe = document.getElementById('playerIframe');
    const episodeListContainer = document.getElementById('overlay-episode-list-container');
    const serverListContainer = document.getElementById('overlay-server-buttons-container');
    
    titleEl.textContent = 'Loading...';
    iframe.src = ''; // Clear iframe to stop previous video
    episodeListContainer.innerHTML = 'Loading episodes...';
    serverListContainer.innerHTML = '';
    
    // 3. Configure UI based on type
    if (type === 'movie') {
        overlay.classList.add('is-movie');
        overlay.classList.remove('is-tv');
        await fetchAndShowMoviePlayer(id);
    } else if (type === 'tv') {
        overlay.classList.add('is-tv');
        overlay.classList.remove('is-movie');
        
        // TODO: Add logic to get last watched episode from localStorage
        // For now, default to S1, E1
        await fetchAndShowTvPlayer(id, season || 1, episode || 1);
    }
}

/**
 * Fetches data for and populates the Movie player.
 * @param {string} id - TMDB movie ID.
 */
async function fetchAndShowMoviePlayer(id) {
    const movieData = await fetchApiData(TMDB_CONFIG.endpoints.movieDetails + id);
    if (!movieData) {
        closePlayer();
        return;
    }

    document.getElementById('overlay-title').textContent = `${movieData.title} (${movieData.release_date.substring(0, 4)})`;
    document.getElementById('overlay-info-details').textContent = `Runtime: ${movieData.runtime} mins · Rating: ${formatRating(movieData.vote_average)}`;

    // This is where you would build your actual streaming URL.
    // For this demo, we'll use a placeholder or an auto-embed.
    // A common pattern is `https://some-player-domain/embed/movie/{tmdbId}`
    const playerUrl = `https://www.2embed.cc/embed/movie/${id}`; // Example embed
    document.getElementById('playerIframe').src = playerUrl;
    
    // Populate "server" buttons
    const serverListContainer = document.getElementById('overlay-server-buttons-container');
    serverListContainer.innerHTML = `
        <button class="server-btn active">Server 1 (Auto)</button>
        <button class="server-btn">Server 2</button>
    `;
    // Add event listeners to server buttons to change iframe.src
}

/**
 * Fetches data for and populates the TV player.
 * @param {string} id - TMDB TV show ID.
 * @param {number} season - Season number.
 * @param {number} episode - Episode number.
 */
async function fetchAndShowTvPlayer(id, season, episode) {
    const showData = await fetchApiData(TMDB_CONFIG.endpoints.tvDetails + id);
    if (!showData) {
        closePlayer();
        return;
    }
    
    const seasonData = await fetchApiData(`/tv/${id}/season/${season}`);
    if (!seasonData) {
        closePlayer();
        return;
    }
    
    const episodeData = seasonData.episodes.find(ep => ep.episode_number === episode);
    
    // Update Title
    document.getElementById('overlay-title').textContent = `${showData.name} · S${season} · E${episode}: ${episodeData.name}`;
    
    // Update Info Row
    document.getElementById('overlay-info-details').textContent = `Air Date: ${episodeData.air_date} · Rating: ${formatRating(episodeData.vote_average)}`;
    
    // Update Iframe
    // A common pattern is `https://some-player-domain/embed/tv/{tmdbId}?s={season}&e={episode}`
    const playerUrl = `https://www.2embed.cc/embed/tv/${id}?s=${season}&e=${episode}`; // Example embed
    document.getElementById('playerIframe').src = playerUrl;

    // Populate Episode List
    const episodeListContainer = document.getElementById('overlay-episode-list-container');
    document.getElementById('tv-episode-list').querySelector('h3').textContent = `Episodes (Season ${season})`;
    episodeListContainer.innerHTML = ''; // Clear
    
    seasonData.episodes.forEach(ep => {
        const epCard = document.createElement('div');
        epCard.className = 'episode-card-mini';
        if (ep.episode_number === episode) {
            epCard.classList.add('active');
        }
        epCard.dataset.id = id;
        epCard.dataset.season = season;
        epCard.dataset.episode = ep.episode_number;

        epCard.innerHTML = `
            <img src="${getImageUrl(ep.still_path, 'w500')}" alt="${ep.name}" loading="lazy">
            <div class="episode-card-mini-info">
                <span class="episode-card-mini-title">E${ep.episode_number}: ${ep.name}</span>
            </div>
        `;
        
        // Add click listener to switch episodes
        epCard.addEventListener('click', () => {
            fetchAndShowTvPlayer(id, season, ep.episode_number);
        });
        
        episodeListContainer.appendChild(epCard);
    });
    
    // TODO: Add Season Selector dropdown/pills
}

/**
 * Closes the overlay player.
 */
function closePlayer() {
    overlay.classList.remove('open');
    document.body.style.overflow = 'auto'; // Restore scrolling

    // Stop the video from playing in the background
    const iframe = document.getElementById('playerIframe');
    iframe.src = '';
}


// ======== 9. WATCH LATER (localStorage) LOGIC ========

const WATCH_LATER_KEY = 'streamVerseWatchLater';

/**
 * Retrieves the Watch Later list from localStorage.
 * @returns {Array<Object>} The array of media items.
 */
function getWatchLaterList() {
    const list = localStorage.getItem(WATCH_LATER_KEY);
    return list ? JSON.parse(list) : [];
}

/**
 * Saves the Watch Later list to localStorage.
 * @param {Array<Object>} list - The array of media items to save.
 */
function saveWatchLaterList(list) {
    localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(list));
}

/**
 * Checks if an item is in the Watch Later list.
 * @param {number} id - The TMDB ID.
 * @returns {boolean} True if the item is in the list.
 */
function checkWatchLaterStatus(id) {
    const list = getWatchLaterList();
    return list.some(item => item.id === id);
}

/**
 * Adds or removes an item from the Watch Later list.
 * @param {number} id - The TMDB ID to toggle.
 * @param {Object} itemData - The full item object to add if it's not present.
 */
function toggleWatchLater(id, itemData) {
    let list = getWatchLaterList();
    const itemIndex = list.findIndex(item => item.id === id);

    if (itemIndex > -1) {
        // Item exists, remove it
        list.splice(itemIndex, 1);
    } else {
        // Item does not exist, add it
        // We use the full itemData object from the button's dataset
        list.push(itemData);
    }

    saveWatchLaterList(list);
}

/**
 * Updates the visual state (icon) of a single Watch Later button.
 * @param {HTMLElement} button - The button element that was clicked.
 * @param {number} id - The ID of the item to check.
 */
function updateWatchLaterButtonUI(button, id) {
    const icon = button.querySelector('.material-icons-outlined');
    if (checkWatchLaterStatus(id)) {
        icon.textContent = 'bookmark'; // Filled icon
        icon.style.fontFamily = 'Material Icons'; // Switch to filled icon set
        button.classList.add('added');
        button.ariaLabel = "Remove from Watch Later";
    } else {
        icon.textContent = 'bookmark_border'; // Outline icon
        icon.style.fontFamily = 'Material Icons Outlined'; // Switch to outline icon set
        button.classList.remove('added');
        button.ariaLabel = "Add to Watch Later";
    }
}

/**
 * Finds all Watch Later buttons on the page and updates their state.
 * Called after new content is loaded.
 */
function updateAllWatchLaterButtons() {
    const buttons = document.querySelectorAll('.btn-add-list');
    buttons.forEach(btn => {
        const id = parseInt(btn.dataset.id);
        if (id) {
            updateWatchLaterButtonUI(btn, id);
        }
    });
}


// ======== 10. UTILITY FUNCTIONS ========

/**
 * Formats a TMDB rating (e.g., 8.1234) to a single decimal (e.g., "8.1").
 * @param {number} vote - The vote_average.
 * @returns {string} The formatted rating.
 */
function formatRating(vote) {
    return vote ? vote.toFixed(1) : 'N/A';
}

/**
 * Escapes a string to be safely stored in an HTML data attribute.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escape(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
