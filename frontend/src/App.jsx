import { useState } from 'react'
import './App.css'

function App() {
  // Keep all ingredient values in one array (max 3 to match backend requirement).
  const [ingredients, setIngredients] = useState(['', '', ''])

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
    // Add one field at a time, up to 3 fields total.
    setVisibleIngredientCount((previousCount) => Math.min(previousCount + 1, 3))
  }

  const handleGenerateIdeas = async () => {
    setError('')
    setResultSource('')

    // Basic frontend validation before calling backend.
    const cleanedIngredients = ingredients.map((item) => item.trim()).filter(Boolean)
    if (cleanedIngredients.length !== 3) {
      setSuggestions([])
      setError('Please enter exactly 3 ingredients.')
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

  return (
    <main className="container">
      <h1>Cooking Idea Generator</h1>
      <p className="subtitle">Enter a few ingredients and get 2-3 meal ideas!</p>

      <section className="card">
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
            type="button"
            onClick={handleNextIngredient}
            disabled={visibleIngredientCount >= 3 || isLoading}
          >
            Next Ingredient
          </button>

          <button type="button" onClick={handleGenerateIdeas} disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate Meal Ideas'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Suggestions</h2>
        {resultSource && <p className="source-label">Source: {sourceLabel}</p>}

        {suggestions.length === 0 ? (
          <p className="hint">No suggestions yet. Generate ideas to see results.</p>
        ) : (
          <ul className="suggestions-list">
            {suggestions.map((meal, index) => (
              <li key={`${meal.name}-${index}`}>
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
