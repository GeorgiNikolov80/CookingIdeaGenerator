import { useState } from 'react'
import './App.css'

const MAX_INGREDIENT_FIELDS = 10

function App() {
  // Keep all ingredient values in one array (up to 10 fields).
  const [ingredients, setIngredients] = useState(Array(MAX_INGREDIENT_FIELDS).fill(''))

  // Number of visible input fields. Start with 1 when app loads.
  const [visibleIngredientCount, setVisibleIngredientCount] = useState(1)

  // Suggestions returned by the backend API.
  const [suggestions, setSuggestions] = useState([])
  const [resultSource, setResultSource] = useState('')

  // Loading and error states improve user feedback.
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Use an environment variable if provided, otherwise local backend URL.
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  const handleIngredientChange = (index, value) => {
    const updatedIngredients = [...ingredients]
    updatedIngredients[index] = value
    setIngredients(updatedIngredients)
  }

  const handleNextIngredient = () => {
    // Add one field at a time, up to 10 fields total.
    setVisibleIngredientCount((previousCount) => Math.min(previousCount + 1, MAX_INGREDIENT_FIELDS))
  }

  const handleBackIngredient = () => {
    // Remove one field at a time, but always keep at least 1 field visible.
    setVisibleIngredientCount((previousCount) => {
      if (previousCount <= 1) {
        return 1
      }

      // Clear the value of the field being removed.
      const updatedIngredients = [...ingredients]
      updatedIngredients[previousCount - 1] = ''
      setIngredients(updatedIngredients)

      return previousCount - 1
    })
  }

  const handleClear = () => {
    // Reset values and UI back to the initial state:
    // one visible empty ingredient field.
    setIngredients(Array(MAX_INGREDIENT_FIELDS).fill(''))
    setVisibleIngredientCount(1)
    setSuggestions([])
    setResultSource('')
    setError('')
  }

  const handleGenerateIdeas = async () => {
    setError('')
    setResultSource('')

    // Basic frontend validation before calling backend.
    const cleanedIngredients = ingredients.map((item) => item.trim()).filter(Boolean)
    if (cleanedIngredients.length === 0) {
      setSuggestions([])
      setError('Please enter at least 1 ingredient.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ingredients: cleanedIngredients }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Something went wrong while generating ideas.')
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])
      setResultSource(data.source || '')
    } catch (requestError) {
      setSuggestions([])
      setResultSource('')
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const sourceLabel = resultSource === 'local-fallback' ? 'local fallback' : resultSource
  const filledIngredientsCount = ingredients.map((item) => item.trim()).filter(Boolean).length
  const disableGenerateAndClear = filledIngredientsCount <= 1

  return (
    <main className="container">
      <h1>Cooking Idea Generator</h1>
      <p className="subtitle">Enter a few ingredients and get 2-3 meal ideas!</p>

      <section className="card">
        <h2 className="section-title">Ingredients</h2>
        <div className="form-grid">
          {Array.from({ length: visibleIngredientCount }).map((_, index) => (
            <label key={`ingredient-${index}`}>
              Ingredient {index + 1}
              <input
                type="text"
                value={ingredients[index]}
                onChange={(event) => handleIngredientChange(index, event.target.value)}
                placeholder={`e.g. ${index === 0 ? 'egg' : index === 1 ? 'tomato' : 'cheese'}`}
              />
            </label>
          ))}
        </div>

        <div className="actions-row">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleNextIngredient}
            disabled={visibleIngredientCount >= MAX_INGREDIENT_FIELDS || isLoading}
          >
            Next Ingredient
          </button>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleBackIngredient}
            disabled={visibleIngredientCount <= 1 || isLoading}
          >
            Back
          </button>

          <button
            className="btn btn-primary"
            type="button"
            onClick={handleGenerateIdeas}
            disabled={isLoading || disableGenerateAndClear}
          >
            {isLoading ? 'Generating...' : 'Generate Meal Ideas'}
          </button>

          <button
            className="btn btn-danger"
            type="button"
            onClick={handleClear}
            disabled={isLoading || disableGenerateAndClear}
          >
            Clear
          </button>
        </div>

        {disableGenerateAndClear && !isLoading && (
          <p className="helper-message">Add at least 2 ingredients to continue.</p>
        )}

        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2 className="section-title">Suggestions</h2>
        {resultSource && <p className="source-label">Source: {sourceLabel}</p>}

        {suggestions.length === 0 ? (
          <p className="hint">No suggestions yet. Generate ideas to see results.</p>
        ) : (
          <ul className="suggestions-list">
            {suggestions.map((meal, index) => (
              <li key={`${meal.name}-${index}`} className="suggestion-item">
                <strong>{meal.name}</strong>
                {meal.matchedIngredients && meal.matchedIngredients.length > 0 && (
                  <p>Matched: {meal.matchedIngredients.join(', ')}</p>
                )}
                {meal.recipeUrl && (
                  <p>
                    <a href={meal.recipeUrl} target="_blank" rel="noreferrer">
                      Open recipe
                    </a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
