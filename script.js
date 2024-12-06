document.addEventListener('DOMContentLoaded', () => {
    let players = [];
    let filteredPlayers = [];
    let targetPlayer = null;
    let attemptsLeft = 6;
    let hintsUsed = 0;
    let currentMode = 'all';

    // Retrieve game statistics from localStorage
    let gamesPlayed = parseInt(localStorage.getItem('gamesPlayed'), 10) || 0;
    let gamesWon = parseInt(localStorage.getItem('gamesWon'), 10) || 0;

    updateScoreboard();

    // Mappings for abbreviations
    const conferenceMapping = {
        "Eastern Conference": "East",
        "Western Conference": "West"
    };

    const divisionMapping = {
        "Northwest Division": "NW",
        "Pacific Division": "Pac",
        "Southwest Division": "SW",
        "Atlantic Division": "Atl",
        "Central Division": "Cen",
        "Southeast Division": "SE"
    };

    const positionCloseMapping = {
        "PG": ["SG"],
        "SG": ["PG", "SF"],
        "SF": ["SG", "PF"],
        "PF": ["SF", "C"],
        "C": ["PF"]
    };

    // Arrays to store sorted players for hints
    let sortedByHeightAsc = [];
    let sortedByHeightDesc = [];
    let sortedByAgeAsc = [];
    let sortedByAgeDesc = [];

    // Object to count players per country
    let countryCounts = {};

    /**
     * Normalize strings for comparison (e.g., user input)
     * Removes accents, converts to lowercase, trims spaces, etc.
     * @param {string} str 
     * @returns {string}
     */
    function normalizeString(str) {
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .toLowerCase()
            .replace(/\b(sr|jr|iii|ii|iv|v)\b/g, '') // Remove suffixes
            .replace(/\./g, '') // Remove periods
            .trim();
    }

    /**
     * Format the years of experience for display
     * @param {string|number} years 
     * @returns {string}
     */
    function formatYearsExperience(years) {
        if (years === "R") return "Rookie";
        const num = parseInt(years, 10);
        if (!isNaN(num)) {
            return num === 1 ? "1 year in the NBA" : `${num} years in the NBA`;
        }
        return "N/A";
    }

    /**
     * Get the URL for the country's flag using FlagCDN
     * @param {string} countryCode 
     * @returns {string}
     */
    function getFlagURL(countryCode) {
        // Using FlagCDN for flag images. Ensure countryCode is lowercase.
        return `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`;
    }

    /**
     * Get the full country name from the country code
     * @param {string} countryCode 
     * @returns {string}
     */
    function getCountryName(countryCode) {
        // Expanded mapping for more countries
        const countryMapping = {
            "us": "United States",
            "ca": "Canada",
            "it": "Italy",
            "fr": "France",
            "es": "Spain",
            "au": "Australia",
            "de": "Germany",
            "br": "Brazil",
            "cn": "China",
            "ch": "Switzerland",
            "gb": "United Kingdom",
            "nl": "Netherlands",
            "gr": "Greece",
            "za": "South Africa",
            "jp": "Japan",
            "kr": "South Korea",
            "mx": "Mexico",
            "ar": "Argentina",
            "cl": "Chile",
            // Add more as needed
        };
        return countryMapping[countryCode] || countryCode.toUpperCase();
    }

    /**
     * Fetch players data from players.json
     */
    fetch('players.json')
        .then(response => response.json())
        .then(data => {
            // Count players per country
            countryCounts = data.reduce((acc, player) => {
                const country = player.birth_country_code.toLowerCase();
                acc[country] = (acc[country] || 0) + 1;
                return acc;
            }, {});

            // Map players and add additional fields
            players = data.map(player => ({
                ...player,
                numeric_salary: parseSalary(player.salary),
                conference_abbr: conferenceMapping[player.conference] || player.conference,
                division_abbr: divisionMapping[player.division] || player.division
            }));

            // Sort arrays for top 10 logic
            sortedByHeightAsc = [...players].sort((a, b) => a.height - b.height);
            sortedByHeightDesc = [...players].sort((a, b) => b.height - a.height);
            sortedByAgeAsc = [...players].sort((a, b) => a.age - b.age);
            sortedByAgeDesc = [...players].sort((a, b) => b.age - a.age);

            populateDatalist();
            setupModeSelection();
            startGame();
        })
        .catch(error => console.error('Error loading players.json:', error));

    /**
     * Populate the datalist for player name suggestions
     */
    function populateDatalist() {
        const datalist = document.getElementById('player-names');
        datalist.innerHTML = '';
        players.forEach(p => {
            const option = document.createElement('option');
            option.value = p.player;
            datalist.appendChild(option);
        });
    }

    /**
     * Setup mode selection event listener
     */
    function setupModeSelection() {
        const modeSelect = document.getElementById('game-mode');
        modeSelect.addEventListener('change', function() {
            currentMode = this.value;
            restartGame();
        });
        filterPlayersByMode();
    }

    /**
     * Filter players based on the selected mode
     */
    function filterPlayersByMode() {
        switch (currentMode) {
            case 'easy':
                filteredPlayers = players.filter(p => p.numeric_salary > 25000000);
                break;
            case 'medium':
                filteredPlayers = players.filter(p => p.numeric_salary >= 7000000 && p.numeric_salary <= 25000000);
                break;
            case 'hard':
                filteredPlayers = players.filter(p => p.numeric_salary >= 1000000 && p.numeric_salary <= 7000000);
                break;
            case 'all':
            default:
                filteredPlayers = [...players];
        }
        updateDatalist();
    }

    /**
     * Update the datalist after filtering
     */
    function updateDatalist() {
        const datalist = document.getElementById('player-names');
        datalist.innerHTML = '';
        filteredPlayers.forEach(p => {
            const option = document.createElement('option');
            option.value = p.player;
            datalist.appendChild(option);
        });
    }

    /**
     * Start or restart the game
     */
    function startGame() {
        filterPlayersByMode();
        if (filteredPlayers.length === 0) {
            showEndBanner('No players in this mode. Please change the mode.', false, null);
            disableInputs();
            return;
        }
        selectTargetPlayer();
        enableInputs();
    }

    /**
     * Enable input fields and buttons
     */
    function enableInputs() {
        document.getElementById('player-guess').disabled = false;
        document.getElementById('submit-guess').disabled = false;
        document.getElementById('hint-button').disabled = false;
    }

    /**
     * Disable input fields and buttons
     */
    function disableInputs() {
        document.getElementById('player-guess').disabled = true;
        document.getElementById('submit-guess').disabled = true;
        document.getElementById('hint-button').disabled = true;
    }

    /**
     * Select a random target player from the filtered list
     */
    function selectTargetPlayer() {
        if (filteredPlayers.length === 0) {
            showEndBanner('No players available. Change the mode.', false, null);
            disableInputs();
            return;
        }
        const idx = Math.floor(Math.random() * filteredPlayers.length);
        targetPlayer = filteredPlayers[idx];
    }

    // Event listeners for buttons and input
    document.getElementById('submit-guess').addEventListener('click', submitGuess);
    document.getElementById('player-guess').addEventListener('keypress', e => {
        if (e.key === 'Enter') submitGuess();
    });
    document.getElementById('hint-button').addEventListener('click', provideHint);
    document.getElementById('restart-game-button').addEventListener('click', restartGame);

    /**
     * Handle the guess submission
     */
    function submitGuess() {
        if (!targetPlayer) {
            showEndBanner('No target player selected. Please change mode or restart.', false, null);
            return;
        }

        const guessInput = document.getElementById('player-guess');
        const guessName = normalizeString(guessInput.value.trim());

        if (!guessName) {
            alert('Enter a player name.');
            return;
        }

        const guessedPlayer = filteredPlayers.find(p => normalizeString(p.normalized_player) === guessName);
        if (!guessedPlayer) {
            alert(`'${guessInput.value}' not found.`);
            return;
        }

        const feedback = calculateFeedback(guessedPlayer, targetPlayer);
        displayGuess(feedback, guessedPlayer);

        attemptsLeft--;
        document.getElementById('attempts-left').textContent = attemptsLeft;

        if (isGameWon(guessedPlayer)) {
            gamesPlayed++;
            gamesWon++;
            saveStats();
            showEndBanner(`🏀 Victory! You guessed ${targetPlayer.player} correctly! 🏀`, true, targetPlayer);
            disableInputs();
        } else if (attemptsLeft === 0) {
            gamesPlayed++;
            saveStats();
            showEndBanner(`😢 Game Over! The correct player was ${targetPlayer.player}. 😢`, false, targetPlayer);
            disableInputs();
        }

        guessInput.value = "";
    }

    /**
     * Calculate feedback for the guessed player compared to the target player
     * @param {Object} guessed 
     * @param {Object} target 
     * @returns {Object}
     */
    function calculateFeedback(guessed, target) {
        const fb = {
            pos: { correct: false, close: false },
            number: { correct: false, close: false, higher: false },
            height: { correct: false, close: false, higher: false },
            age: { correct: false, close: false, higher: false },
            team: { correct: false },
            conference: { correct: false },
            division: { correct: false }
        };

        // Position Feedback
        if (guessed.pos === target.pos) {
            fb.pos.correct = true;
        } else if (positionCloseMapping[target.pos]?.includes(guessed.pos)) {
            fb.pos.close = true;
        }

        // Number Feedback
        const gN = parseInt(guessed.number, 10), tN = parseInt(target.number, 10);
        if (gN === tN) {
            fb.number.correct = true;
        } else if (!isNaN(gN) && !isNaN(tN)) {
            if (Math.abs(gN - tN) === 1) fb.number.close = true;
            fb.number.higher = gN < tN;
        }

        // Height Feedback
        const gH = guessed.height, tH = target.height;
        if (gH === tH) {
            fb.height.correct = true;
        } else if (!isNaN(gH) && !isNaN(tH)) {
            if (Math.abs(gH - tH) <= 1) fb.height.close = true;
            fb.height.higher = gH < tH;
        }

        // Age Feedback
        const gA = parseInt(guessed.age, 10), tA = parseInt(target.age, 10);
        if (gA === tA) {
            fb.age.correct = true;
        } else if (!isNaN(gA) && !isNaN(tA)) {
            if (Math.abs(gA - tA) === 1) fb.age.close = true;
            fb.age.higher = gA < tA;
        }

        // Team, Conference, Division Feedback
        fb.team.correct = guessed.team === target.team;
        fb.conference.correct = guessed.conference === target.conference;
        fb.division.correct = guessed.division === target.division;

        return fb;
    }

    /**
     * Display the guess and feedback on the page
     * @param {Object} feedback 
     * @param {Object} guessedPlayer 
     */
    function displayGuess(feedback, guessedPlayer) {
        const guessesContainer = document.getElementById('guesses');
        const guessIndex = 7 - attemptsLeft;
        const guessBlock = document.createElement('div');
        guessBlock.classList.add('guess-block');

        // Guess Title
        const guessTitle = document.createElement('h2');
        guessTitle.textContent = `Guess ${guessIndex}`;
        guessBlock.appendChild(guessTitle);

        // Player Info
        const playerInfo = document.createElement('div');
        playerInfo.classList.add('player-info');

        const img = document.createElement('img');
        img.classList.add('player-img');

        // Extract the filename from the image path
        const imageFilename = guessedPlayer.image.split('/').pop();
        // Encode URI components to handle spaces and special characters
        const encodedImage = encodeURI(imageFilename);
        img.src = encodedImage; // Reference image in root directory
        img.alt = "Player Photo";
        img.onerror = function() { this.src = 'default.jpg'; }; // Ensure default image exists in root

        const playerNameDiv = document.createElement('div');
        playerNameDiv.classList.add('player-name');

        // Add flag and years in NBA
        const flagImg = document.createElement('img');
        flagImg.src = getFlagURL(guessedPlayer.birth_country_code);
        flagImg.alt = `${guessedPlayer.birth_country_code.toUpperCase()} Flag`;
        flagImg.width = 20;
        flagImg.height = 15;

        const yearsText = document.createElement('span');
        yearsText.textContent = formatYearsExperience(guessedPlayer.years_experience);

        playerNameDiv.appendChild(document.createTextNode(guessedPlayer.player));
        playerNameDiv.appendChild(flagImg);
        playerNameDiv.appendChild(document.createTextNode(` | ${yearsText.textContent}`));

        playerInfo.appendChild(img);
        playerInfo.appendChild(playerNameDiv);
        guessBlock.appendChild(playerInfo);

        // Main Stats
        const mainStatsDiv = document.createElement('div');
        mainStatsDiv.classList.add('main-stats');
        mainStatsDiv.innerHTML = buildMainStatsLine(feedback, guessedPlayer, targetPlayer);
        guessBlock.appendChild(mainStatsDiv);

        // Team Stats
        const teamStatsDiv = document.createElement('div');
        teamStatsDiv.classList.add('team-stats');
        teamStatsDiv.innerHTML = buildTeamStatsLine(feedback, guessedPlayer, targetPlayer);
        guessBlock.appendChild(teamStatsDiv);

        // Append the guess block to the container
        guessesContainer.appendChild(guessBlock);
    }

    /**
     * Build the main stats line with feedback
     * @param {Object} fb 
     * @param {Object} g 
     * @param {Object} t 
     * @returns {string}
     */
    function buildMainStatsLine(fb, g, t) {
        const ageEmoji = g.age >= 30 ? '👴' : '🧒'; 
        const posStr = formatAndWrapStat(`🏀 ${g.pos}`, fb.pos);
        const heightStr = formatAndWrapStat(`📏 ${formatHeight(g.height)}`, fb.height);
        const ageStr = formatAndWrapStat(`${ageEmoji} Age: ${g.age}`, fb.age);
        const noStr = formatAndWrapStat(`#${g.number}`, fb.number);

        return `${posStr} ${heightStr} ${ageStr} ${noStr}`;
    }

    /**
     * Build the team stats line with feedback
     * @param {Object} fb 
     * @param {Object} g 
     * @param {Object} t 
     * @returns {string}
     */
    function buildTeamStatsLine(fb, g, t) {
        const teamStr = `🏙️ Team: ${g.team}`;
        const confStr = `🌎 ${g.conference_abbr}`;
        const divStr = `📍 Div: ${g.division_abbr}`;

        const teamStat = formatAndWrapStat(teamStr, fb.team);
        const confStat = formatAndWrapStat(confStr, fb.conference);
        const divStat = formatAndWrapStat(divStr, fb.division);

        return `${teamStat} ${confStat} ${divStat}`;
    }

    /**
     * Format and wrap stats with feedback icons and styles
     * @param {string} value 
     * @param {Object} fbObj 
     * @returns {string}
     */
    function formatAndWrapStat(value, fbObj) {
        let formattedVal = '';
        if (fbObj.correct) {
            formattedVal = `${value}✅`;
        } else if (fbObj.close) {
            formattedVal = `${value}⚠️`;
        } else {
            formattedVal = `${value}❌`;
        }

        // Add arrows if numeric and not correct:
        // If height/age/number difference and fbObj.higher defined:
        // fbObj.higher = true means guess < target, so arrow up (go higher)
        // fbObj.higher = false means guess > target, so arrow down (go lower)
        if ('higher' in fbObj && fbObj.higher !== undefined && !fbObj.correct) {
            formattedVal += fbObj.higher ? '▲' : '▼';
        }

        return wrapStat(formattedVal);
    }

    /**
     * Wrap the stat in a styled span based on feedback
     * @param {string} content 
     * @returns {string}
     */
    function wrapStat(content) {
        let className = 'stat-incorrect';
        if (content.includes('✅')) className = 'stat-correct';
        else if (content.includes('⚠️')) className = 'stat-close';

        return `<span class="stat-box ${className}">${content}</span>`;
    }

    /**
     * Check if the game is won
     * @param {Object} gp 
     * @returns {boolean}
     */
    function isGameWon(gp) {
        return gp.player === targetPlayer?.player;
    }

    /**
     * Provide hints to the user based on hints used
     */
    function provideHint() {
        if (!targetPlayer) {
            alert('No target player selected. Please restart.');
            return;
        }

        const hintArea = document.getElementById('hint-area');
        hintArea.classList.remove('hidden');

        if (hintsUsed === 0) {
            // Hint 1: Salary information
            const salary = targetPlayer.numeric_salary;
            hintArea.innerHTML = `<p><strong>🏀 Hint 1:</strong> The player's salary is approximately $${salary.toLocaleString()} per year.</p>`;
            hintsUsed++;
        } else if (hintsUsed === 1) {
            // Hint 2: Blurred image
            const blurredImageFilename = targetPlayer.image.split('/').pop();
            const encodedBlurredImage = encodeURI(blurredImageFilename);
            hintArea.innerHTML += `
                <img src="${encodedBlurredImage}" alt="${targetPlayer.player} (Blurred)" class="blurred-image">
                <p class="hint-label">🏀 Hint 2: Here is a blurred image of the player.</p>
            `;
            hintsUsed++;
        } else if (hintsUsed === 2) {
            // Hint 3: Top 10 category or country info or half image
            const categoryHint = determineTop10Category(targetPlayer);
            if (categoryHint) {
                hintArea.innerHTML += `<p><strong>🏀 Hint 3:</strong> ${categoryHint}</p>`;
            } else {
                // Check if country has less than 15 players
                const countryCode = targetPlayer.birth_country_code.toLowerCase();
                const countryName = getCountryName(countryCode);
                const count = countryCounts[countryCode] || 0;

                if (count > 0 && count < 15) {
                    // Include flag in the hint
                    hintArea.innerHTML += `
                        <p><strong>🏀 Hint 3:</strong> This player is 1 of ${count} from <img src="${getFlagURL(countryCode)}" alt="${countryName} Flag" width="20" height="15"> ${countryName}.</p>
                    `;
                } else {
                    // Reveal half the image
                    const halfImageFilename = targetPlayer.image.split('/').pop();
                    const encodedHalfImage = encodeURI(halfImageFilename);
                    hintArea.innerHTML += `
                        <img src="${encodedHalfImage}" alt="${targetPlayer.player} (Half Image)" class="half-image">
                        <p class="hint-label">🏀 Hint 3: Here is half of the player's image.</p>
                    `;
                }
            }
            hintsUsed++;
        } else {
            alert('🔒 No more hints available.');
        }
    }

    /**
     * Determine if the player is in any top 10 category
     * @param {Object} player 
     * @returns {string|null}
     */
    function determineTop10Category(player) {
        // Check tallest
        const tallestIdx = sortedByHeightDesc.findIndex(p => p.player === player.player);
        if (tallestIdx !== -1 && tallestIdx < 10) {
            return "This player is among the top 10 tallest players in the NBA.";
        }

        // Check shortest
        const shortestIdx = sortedByHeightAsc.findIndex(p => p.player === player.player);
        if (shortestIdx !== -1 && shortestIdx < 10) {
            return "This player is among the top 10 shortest players in the NBA.";
        }

        // Check youngest
        const youngestIdx = sortedByAgeAsc.findIndex(p => p.player === player.player);
        if (youngestIdx !== -1 && youngestIdx < 10) {
            return "This player is among the top 10 youngest players in the NBA.";
        }

        // Check oldest
        const oldestIdx = sortedByAgeDesc.findIndex(p => p.player === player.player);
        if (oldestIdx !== -1 && oldestIdx < 10) {
            return "This player is among the top 10 oldest players in the NBA.";
        }

        // If none apply, return null
        return null;
    }

    /**
     * Restart the game by resetting variables and UI elements
     */
    function restartGame() {
        attemptsLeft = 6;
        hintsUsed = 0;
        document.getElementById('attempts-left').textContent = attemptsLeft;
        document.getElementById('guesses').innerHTML = '';
        const hintArea = document.getElementById('hint-area');
        hintArea.classList.add('hidden');
        hintArea.innerHTML = '';
        targetPlayer = null;
        document.getElementById('player-guess').value = '';
        document.getElementById('restart-game-button').classList.add('hidden');

        const banner = document.getElementById('game-end-banner');
        banner.classList.add('hidden');
        banner.innerHTML = '';

        startGame();
    }

    /**
     * Display the end game banner with message and player info
     * @param {string} message 
     * @param {boolean} won 
     * @param {Object} player 
     */
    function showEndBanner(message, won, player) {
        const banner = document.getElementById('game-end-banner');
        let playerInfoHTML = '';
        if (player) {
            playerInfoHTML = buildEndGamePlayerInfo(player); 
        }

        banner.innerHTML = `
            <div>${message}</div>
            ${playerInfoHTML}
            <button id="play-again-button">Play Again</button>
        `;
        banner.classList.remove('hidden');

        // Scroll into view smoothly
        banner.scrollIntoView({ behavior: 'smooth' });

        // Add event listener to "Play Again" button
        const playAgainBtn = document.getElementById('play-again-button');
        playAgainBtn.addEventListener('click', () => {
            banner.innerHTML = '';
            banner.classList.add('hidden');
            restartGame();
        });
    }

    /**
     * Build the end game player info section
     * @param {Object} player 
     * @returns {string}
     */
    function buildEndGamePlayerInfo(player) {
        const ageEmoji = player.age >= 30 ? '👴' : '🧒'; 
        const posStat = neutralStat(`🏀 ${player.pos}`);
        const heightStat = neutralStat(`📏 ${formatHeight(player.height)}`);
        const ageStat = neutralStat(`${ageEmoji} Age: ${player.age}`);
        const noStat = neutralStat(`#${player.number}`);

        const teamStr = `🏙️ Team: ${player.team}`;
        const confStr = `🌎 ${player.conference_abbr}`;
        const divStr = `📍 Div: ${player.division_abbr}`;

        const teamStat = neutralStat(teamStr);
        const confStat = neutralStat(confStr);
        const divStat = neutralStat(divStr);

        // Extract filename for player image
        const imageFilename = player.image.split('/').pop();
        const encodedImage = encodeURI(imageFilename);

        return `
        <div class="end-player-info">
            <div class="player-info">
                <img class="player-img" src="${encodedImage}" alt="Player Photo" onerror="this.src='default.jpg';">
                <div class="player-name">
                    ${player.player}
                    <img src="${getFlagURL(player.birth_country_code)}" alt="${getCountryName(player.birth_country_code)} Flag" width="20" height="15">
                    | ${formatYearsExperience(player.years_experience)}
                </div>
            </div>
            <div class="end-player-stats">
                ${posStat} ${heightStat} ${ageStat} ${noStat}
                <br>
                ${teamStat} ${confStat} ${divStat}
            </div>
        </div>`;
    }

    /**
     * Wrap neutral stats without feedback icons
     * @param {string} value 
     * @returns {string}
     */
    function neutralStat(value) {
        return `<span class="stat-box">${value}</span>`;
    }

    /**
     * Save game statistics to localStorage
     */
    function saveStats() {
        localStorage.setItem('gamesPlayed', gamesPlayed.toString());
        localStorage.setItem('gamesWon', gamesWon.toString());
        updateScoreboard();
    }

    /**
     * Update the scoreboard display
     */
    function updateScoreboard() {
        document.getElementById('games-played').textContent = gamesPlayed;
        document.getElementById('games-won').textContent = gamesWon;
    }

    /**
     * Parse the salary string to a numeric value
     * @param {string} salaryStr 
     * @returns {number}
     */
    function parseSalary(salaryStr) {
        const cleaned = salaryStr.replace(/[^0-9]/g, '');
        const sal = parseFloat(cleaned);
        if (isNaN(sal)) {
            console.error(`Invalid salary: "${salaryStr}".`);
            return 0;
        }
        return sal;
    }

    /**
     * Format height from inches to "ft-in" format
     * @param {number} inches 
     * @returns {string}
     */
    function formatHeight(inches) {
        if (typeof inches !== 'number' || isNaN(inches)) return 'N/A';
        const ft = Math.floor(inches / 12);
        const inch = inches % 12;
        return `${ft}-${inch}`;
    }
});
