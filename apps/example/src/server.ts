import 'dotenv/config'
import express from 'express'
import Redis from 'ioredis'
import { stripe402Middleware } from '@stripe402/express'
import { RedisStore } from '@stripe402/server'
import { unitsToDollars } from '@stripe402/core'

const app = express()
const port = process.env.PORT ?? 3000
const minTopUp = parseInt(process.env.MIN_TOP_UP ?? '50000', 10) // units (1 unit = 1/10000 dollar)

// Redis connection (defaults to localhost:6379)
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const store = new RedisStore(redis)

// Apply stripe402 middleware
app.use(
  stripe402Middleware({
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    serverSecret: process.env.SERVER_SECRET ?? 'change-me-in-production',
    store,
    routes: {
      'GET /api/joke': {
        amount: 100, // 1 cent per joke (100 units)
        minTopUp,
        description: 'Random joke',
      },
      'GET /api/weather': {
        amount: 500, // 5 cents per weather lookup (500 units)
        minTopUp,
        description: 'Weather data',
      },
    },
  })
)

// Free endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Paid endpoints (protected by middleware above)
app.get('/api/joke', (_req, res) => {
  const jokes = [
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'There are only 10 types of people in the world: those who understand binary and those who don\'t.',
    'A SQL query walks into a bar, sees two tables, and asks "Can I JOIN you?"',
    'Why did the developer go broke? Because he used up all his cache.',
    'What\'s a programmer\'s favorite hangout place? Foo Bar.',
  ]
  const joke = jokes[Math.floor(Math.random() * jokes.length)]
  res.json({ joke })
})

app.get('/api/weather', (_req, res) => {
  res.json({
    location: 'San Francisco, CA',
    temperature: 62,
    unit: 'fahrenheit',
    conditions: 'Partly cloudy',
    humidity: 72,
  })
})

app.listen(port, () => {
  console.log(`stripe402 example server running on http://localhost:${port}`)
  console.log(`  Free:  GET /api/health`)
  console.log(`  Paid:  GET /api/joke    (1¢ per request, $${unitsToDollars(minTopUp)} min top-up)`)
  console.log(`  Paid:  GET /api/weather (5¢ per request, $${unitsToDollars(minTopUp)} min top-up)`)
})
