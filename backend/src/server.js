const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const meals = require("./data/meals");

// Loads variables from .env into process.env
// Example: PORT=3001
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const RECIPE_API_BASE_URL = "https://www.themealdb.com/api/json/v1/1";
const ENGLISH_AREAS = new Set([
  "American",
  "British",
  "Canadian",
  "Irish",
  "Jamaican",
  "Australian",
  "New Zealand"
]);
const POPULAR_RECIPE_DOMAINS = [
  "bbcgoodfood.com",
  "allrecipes.com",
  "foodnetwork.com",
  "jamieoliver.com",
  "epicurious.com",
  "delish.com",
  "seriouseats.com",
  "simplyrecipes.com"
];

// Middleware:
// - cors() lets the frontend (Vite app) call this API during development
// - express.json() lets us read JSON from request bodies
app.use(cors());
app.use(express.json());

// Reusable local fallback logic: uses predefined meals in ./data/meals
function getLocalSuggestions(normalizedIngredients) {
  const scoredMeals = meals
    .map((meal) => {
      const mealIngredientsLower = meal.ingredients.map((item) => item.toLowerCase());
      const matchedIngredients = normalizedIngredients.filter((ingredient) =>
        mealIngredientsLower.includes(ingredient)
      );

      return {
        name: meal.name,
        matchedIngredients,
        matchCount: matchedIngredients.length,
        source: "local"
      };
    })
    .filter((meal) => meal.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 3);

  if (scoredMeals.length === 0) {
    return [
      { name: "Simple Salad", matchedIngredients: [], note: "No strong match found", source: "local" },
      { name: "Fried Rice", matchedIngredients: [], note: "No strong match found", source: "local" }
    ];
  }

  return scoredMeals;
}

function isMostlyEnglishText(value) {
  if (!value) {
    return false;
  }

  // Simple heuristic: allow common Latin letters, numbers, and punctuation.
  return /^[a-z0-9\s'’.,:;!?()\-/&]+$/i.test(value);
}

function getDomain(urlValue) {
  if (!urlValue) {
    return null;
  }

  try {
    return new URL(urlValue).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isPopularRecipeDomain(urlValue) {
  const domain = getDomain(urlValue);
  if (!domain) {
    return false;
  }

  return POPULAR_RECIPE_DOMAINS.some((popularDomain) => domain.includes(popularDomain));
}

function buildPopularityScore({ matchCount, details, recipeUrl }) {
  const englishAreaBonus = details?.strArea && ENGLISH_AREAS.has(details.strArea) ? 20 : 0;
  const englishNameBonus = isMostlyEnglishText(details?.strMeal || "") ? 15 : 0;
  const sourceBonus = details?.strSource ? 25 : 0;
  const youtubeBonus = details?.strYoutube ? 10 : 0;
  const popularDomainBonus = isPopularRecipeDomain(recipeUrl) ? 20 : 0;

  return (
    matchCount * 100 +
    englishAreaBonus +
    englishNameBonus +
    sourceBonus +
    youtubeBonus +
    popularDomainBonus
  );
}

function isEnglishRecipe(details) {
  if (!details) {
    return false;
  }

  const englishByArea = details.strArea && ENGLISH_AREAS.has(details.strArea);
  const englishByTitle = isMostlyEnglishText(details.strMeal || "");

  return englishByArea || englishByTitle;
}

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
}

function listFromQuery(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item || "").split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

// Calls TheMealDB for one ingredient and returns a list of meals.
async function fetchMealsByIngredient(ingredient) {
  const url = `${RECIPE_API_BASE_URL}/filter.php?i=${encodeURIComponent(ingredient)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Recipe API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.meals || [];
}

// Fetches meal details to include recipe links (when available).
async function fetchMealDetails(mealId) {
  const url = `${RECIPE_API_BASE_URL}/lookup.php?i=${encodeURIComponent(mealId)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Meal details request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.meals?.[0] || null;
}

// Simple health endpoint to quickly confirm that backend is running
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

async function createSuggestionsResponse({ ingredients, excludeNames }) {
  const normalized = normalizeList(ingredients);
  const normalizedExcludeNames = normalizeList(excludeNames);

  if (normalized.length === 0) {
    const error = new Error("Please provide at least 1 ingredient.");
    error.status = 400;
    throw error;
  }

  if (normalized.length > 10) {
    const error = new Error("Please provide no more than 10 ingredients.");
    error.status = 400;
    throw error;
  }

  try {
    // Search meals for each ingredient in parallel.
    const webResultsByIngredient = await Promise.all(
      normalized.map((ingredient) => fetchMealsByIngredient(ingredient))
    );

    // Count how many selected ingredients match each meal.
    const mealMap = new Map();

    webResultsByIngredient.forEach((mealList, ingredientIndex) => {
      const ingredient = normalized[ingredientIndex];

      mealList.forEach((meal) => {
        const existing = mealMap.get(meal.idMeal) || {
          idMeal: meal.idMeal,
          name: meal.strMeal,
          thumbnail: meal.strMealThumb,
          matchedIngredients: []
        };

        if (!existing.matchedIngredients.includes(ingredient)) {
          existing.matchedIngredients.push(ingredient);
        }

        mealMap.set(meal.idMeal, existing);
      });
    });

    const topCandidates = Array.from(mealMap.values())
      .sort((a, b) => b.matchedIngredients.length - a.matchedIngredients.length)
      .slice(0, 15);

    // If web search found no matches, return local fallback.
    if (topCandidates.length === 0) {
      return {
        suggestions: getLocalSuggestions(normalized),
        source: "local-fallback"
      };
    }

    // Enrich candidates with recipe details, then rank by popularity signals.
    const enrichedCandidates = await Promise.all(
      topCandidates.map(async (candidate) => {
        const details = await fetchMealDetails(candidate.idMeal).catch(() => null);
        const recipeUrl = details?.strSource || details?.strYoutube || null;

        return {
          name: candidate.name,
          matchedIngredients: candidate.matchedIngredients,
          image: candidate.thumbnail,
          recipeUrl,
          details,
          matchCount: candidate.matchedIngredients.length,
          popularityScore: buildPopularityScore({
            matchCount: candidate.matchedIngredients.length,
            details,
            recipeUrl
          })
        };
      })
    );

    const rankedEnglishCandidates = enrichedCandidates
      .filter((candidate) => isEnglishRecipe(candidate.details))
      .sort((a, b) => b.popularityScore - a.popularityScore);

    const excludeNameSet = new Set(normalizedExcludeNames);
    const filteredCandidates = rankedEnglishCandidates.filter(
      (candidate) => !excludeNameSet.has(candidate.name.toLowerCase())
    );

    // If refresh exclusion removes everything, gracefully fall back to normal ranking.
    const selectedCandidates = filteredCandidates.length > 0 ? filteredCandidates : rankedEnglishCandidates;

    const englishPopularSuggestions = selectedCandidates
      .slice(0, 3)
      .map((candidate) => ({
        name: candidate.name,
        matchedIngredients: candidate.matchedIngredients,
        image: candidate.image,
        recipeUrl: candidate.recipeUrl,
        source: "web"
      }));

    if (englishPopularSuggestions.length === 0) {
      return {
        suggestions: getLocalSuggestions(normalized),
        source: "local-fallback",
        note: "No English web recipes matched strongly, showing local suggestions instead."
      };
    }

    return { suggestions: englishPopularSuggestions, source: "web" };
  } catch (error) {
    // If the web lookup fails (e.g., no internet), fall back to local logic.
    return {
      suggestions: getLocalSuggestions(normalized),
      source: "local-fallback",
      note: "Web recipe lookup failed, showing local suggestions instead."
    };
  }
}

// GET /api/suggestions?ingredients=egg,tomato&excludeNames=omelette
app.get("/api/suggestions", async (req, res) => {
  try {
    const payload = await createSuggestionsResponse({
      ingredients: listFromQuery(req.query.ingredients),
      excludeNames: listFromQuery(req.query.excludeNames)
    });

    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "Unexpected server error."
    });
  }
});

// POST /api/suggestions
// Expects: { ingredients: ["item1", "item2", ...] } (1 to 10 ingredients)
// Returns top 2-3 meal suggestions based on matched ingredients.
// Uses web results, prioritizing popular English recipes first.
// Falls back to local predefined meals if needed.
app.post("/api/suggestions", async (req, res) => {
  try {
    if (!Array.isArray(req.body?.ingredients)) {
      return res.status(400).json({
        error: "'ingredients' must be an array with up to 10 text values."
      });
    }

    const payload = await createSuggestionsResponse(req.body);
    return res.json(payload);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "Unexpected server error."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
