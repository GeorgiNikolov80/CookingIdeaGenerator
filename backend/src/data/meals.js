// Predefined meals used by the API.
// Each meal has a name and a list of ingredients.
// Later, you can move this to a local JSON file database.
const meals = [
  {
    name: "Tomato Omelette",
    ingredients: ["egg", "tomato", "cheese", "onion"]
  },
  {
    name: "Chicken Rice Bowl",
    ingredients: ["chicken", "rice", "onion", "garlic"]
  },
  {
    name: "Pasta al Pomodoro",
    ingredients: ["pasta", "tomato", "garlic", "basil"]
  },
  {
    name: "Veggie Stir Fry",
    ingredients: ["broccoli", "carrot", "soy sauce", "onion"]
  },
  {
    name: "Bean Quesadilla",
    ingredients: ["tortilla", "beans", "cheese", "tomato"]
  },
  {
    name: "Garlic Butter Shrimp",
    ingredients: ["shrimp", "garlic", "butter", "lemon"]
  }
];

module.exports = meals;
