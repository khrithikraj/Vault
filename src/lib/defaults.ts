import type { Category, FieldDefinition } from '../types/app'

const foodFields: FieldDefinition[] = [
  { key: 'title', label: 'Place name', type: 'text', required: true },
  { key: 'dish', label: 'Dish to try', type: 'text', required: true },
  { key: 'address', label: 'Address', type: 'text', required: false },
  { key: 'price', label: 'Price', type: 'currency', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const buyFields: FieldDefinition[] = [
  { key: 'title', label: 'Item name', type: 'text', required: true },
  { key: 'link', label: 'Where to buy / link', type: 'url', required: false },
  { key: 'price', label: 'Price', type: 'currency', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const wishlistFields: FieldDefinition[] = [
  { key: 'title', label: 'Item name', type: 'text', required: true },
  { key: 'brand', label: 'Brand', type: 'text', required: false },
  { key: 'price', label: 'Price', type: 'currency', required: false },
  { key: 'link', label: 'Link', type: 'url', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const movieFields: FieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'genre', label: 'Genre', type: 'text', required: false },
  { key: 'platform', label: 'Platform', type: 'text', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const templeFields: FieldDefinition[] = [
  { key: 'title', label: 'Name', type: 'text', required: true },
  { key: 'location', label: 'Location', type: 'text', required: false },
  { key: 'best_time', label: 'Best time to visit', type: 'text', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const educationFields: FieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'link', label: 'Source / link', type: 'url', required: false },
  { key: 'topic', label: 'Topic', type: 'text', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

const placesFields: FieldDefinition[] = [
  { key: 'title', label: 'Name', type: 'text', required: true },
  { key: 'location', label: 'Location', type: 'text', required: false },
  { key: 'best_season', label: 'Best season', type: 'text', required: false },
  { key: 'notes', label: 'Notes', type: 'textarea', required: false },
]

export const defaultCategorySeeds: Array<
  Pick<Category, 'name' | 'color' | 'icon' | 'is_default' | 'field_schema'>
> = [
  { name: 'Food Spots', color: '#ffd9c3', icon: '🍜', is_default: true, field_schema: foodFields },
  {
    name: 'Things To Buy',
    color: '#cfe7ff',
    icon: '🛍️',
    is_default: true,
    field_schema: buyFields,
  },
  {
    name: 'Shopping Wishlist',
    color: '#dbf4cb',
    icon: '⌚',
    is_default: true,
    field_schema: wishlistFields,
  },
  {
    name: 'Movies & Series',
    color: '#e4d7ff',
    icon: '🎬',
    is_default: true,
    field_schema: movieFields,
  },
  { name: 'Temples', color: '#ffe9b8', icon: '🛕', is_default: true, field_schema: templeFields },
  {
    name: 'Education Reels',
    color: '#ccf5ec',
    icon: '📚',
    is_default: true,
    field_schema: educationFields,
  },
  {
    name: 'Places To Visit',
    color: '#ffd3d8',
    icon: '📍',
    is_default: true,
    field_schema: placesFields,
  },
]
