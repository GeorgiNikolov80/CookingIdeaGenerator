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

// Middleware:
// - cors() lets the frontend (Vite app) call this API during development
// - express.json() lets us read JSON from request bodies
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without Origin (for tools like Postman/PowerShell)
      if (!origin) {
        return callback(null, true);
      }

      // Allow any local frontend port: 5173, 5174, 5175, etc.
      if (/^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked: origin not allowed"));
    }
  })
);
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

// POST /api/suggestions
// Expects: { ingredients: ["item1", "item2", "item3"] }
// Returns top 2-3 meal suggestions based on matched ingredients.
// First tries web search, then falls back to local predefined meals.
app.post("/api/suggestions", async (req, res) => {
  const { ingredients } = req.body;

  // Basic validation for beginner-friendly error messages
  if (!Array.isArray(ingredients)) {
    return res.status(400).json({
      error: "'ingredients' must be an array of 3 text values."
    });
  }

  const normalized = ingredients
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length !== 3) {
    return res.status(400).json({
      error: "Please provide exactly 3 ingredients."
    });
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
      .slice(0, 3);

    // If web search found no matches, return local fallback.
    if (topCandidates.length === 0) {
      return res.json({
        suggestions: getLocalSuggestions(normalized),
        source: "local-fallback"
      });
    }

    // Enrich top candidates with recipe/source links.
    const suggestions = await Promise.all(
      topCandidates.map(async (candidate) => {
        const details = await fetchMealDetails(candidate.idMeal).catch(() => null);

        return {
          name: candidate.name,
          matchedIngredients: candidate.matchedIngredients,
          image: candidate.thumbnail,
          recipeUrl: details?.strSource || details?.strYoutube || null,
          source: "web"
        };
      })
    );

    return res.json({ suggestions, source: "web" });
  } catch (error) {
    // If the web lookup fails (e.g., no internet), fall back to local logic.
    return res.json({
      suggestions: getLocalSuggestions(normalized),
      source: "local-fallback",
      note: "Web recipe lookup failed, showing local suggestions instead."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
