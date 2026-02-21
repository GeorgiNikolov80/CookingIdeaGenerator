import { useState } from 'react'
import './App.css'

function App() {
  // We keep 3 ingredient fields in one array so the form stays simple.
  const [ingredients, setIngredients] = useState(['', '', ''])

  // Suggestions returned by the backend API.
  const [suggestions, setSuggestions] = useState([])

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

  const handleGenerateIdeas = async () => {
    setError('')

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
    } catch (requestError) {
      setSuggestions([])
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="container">
      <h1>Cooking Idea Generator</h1>
      <p className="subtitle">Enter 3 ingredients and get 2-3 meal ideas.</p>

      <section className="card">
        <div className="form-grid">
          <label>
            Ingredient 1
            <input
              type="text"
              value={ingredients[0]}
              onChange={(event) => handleIngredientChange(0, event.target.value)}
              placeholder="e.g. egg"
            />
          </label>

          <label>
            Ingredient 2
            <input
              type="text"
              value={ingredients[1]}
              onChange={(event) => handleIngredientChange(1, event.target.value)}
              placeholder="e.g. tomato"
            />
          </label>

          <label>
            Ingredient 3
            <input
              type="text"
              value={ingredients[2]}
              onChange={(event) => handleIngredientChange(2, event.target.value)}
              placeholder="e.g. cheese"
            />
          </label>
        </div>

        <button onClick={handleGenerateIdeas} disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Meal Ideas'}
        </button>

        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Suggestions</h2>

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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
