/**
 * StarRating – Klickbare Stern-Bewertungskomponente.
 * 
 * @param {Object} props
 * @param {number} props.rating   - Aktueller Rating-Wert (0–10)
 * @param {Function} props.onChange - Callback bei Klick: (newRatingValue) => void
 * @param {number} [props.size=14] - Schriftgröße der Sterne in px
 */
import { STAR_VALUES, starsFromRating } from '../utils';

export default function StarRating({ rating, onChange, size = 14 }) {
  const stars = starsFromRating(rating);
  return (
    <span className="star-rating" title="Community Rating">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`star ${i <= stars ? 'active' : ''}`}
          style={{ fontSize: size }}
          onClick={(e) => {
            e.stopPropagation();
            const allFull = stars === 5;
            if (allFull && i === 5) {
              onChange(0); // Rating entfernen (zurücksetzen)
            } else {
              onChange(STAR_VALUES[i - 1]);
            }
          }}
          title={`${i} Stern${i > 1 ? 'e' : ''} (Rating ${STAR_VALUES[i - 1]})`}
        >★</span>
      ))}
    </span>
  );
}
