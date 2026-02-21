const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const meals = require("./data/meals");

// Loads variables from .env into process.env
// Example: PORT=3001
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware:
// - cors() lets the frontend (Vite app) call this API during development
// - express.json() lets us read JSON from request bodies
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Simple health endpoint to quickly confirm that backend is running
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

// POST /api/suggestions
// Expects: { ingredients: ["item1", "item2", "item3"] }
// Returns top 2-3 meal suggestions based on matched ingredients.
app.post("/api/suggestions", (req, res) => {
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

  // Score each predefined meal by how many input ingredients match
  const scoredMeals = meals
    .map((meal) => {
      const mealIngredientsLower = meal.ingredients.map((item) => item.toLowerCase());
      const matchedIngredients = normalized.filter((ingredient) =>
        mealIngredientsLower.includes(ingredient)
      );

      return {
        name: meal.name,
        matchedIngredients,
        matchCount: matchedIngredients.length
      };
    })
    // Keep meals with at least 1 match
    .filter((meal) => meal.matchCount > 0)
    // Sort best matches first
    .sort((a, b) => b.matchCount - a.matchCount)
    // Return only 2-3 suggestions (here: up to 3)
    .slice(0, 3);

  // If nothing matches, return a simple fallback set
  if (scoredMeals.length === 0) {
    return res.json({
      suggestions: [
        { name: "Simple Salad", matchedIngredients: [], note: "No strong match found" },
        { name: "Fried Rice", matchedIngredients: [], note: "No strong match found" }
      ]
    });
  }

  return res.json({ suggestions: scoredMeals });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
