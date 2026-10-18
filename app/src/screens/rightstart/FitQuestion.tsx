import { Navigate, useParams } from 'react-router-dom';
import { FitQuestionScreen } from './components/FitQuestionScreen';

/** Screen 03: Fit questions 2 to 5 (`/check/2` ... `/check/5`). Any other step goes back to question 1. */
export default function FitQuestion() {
  const { step } = useParams();
  const n = Number(step);
  if (n === 2 || n === 3 || n === 4 || n === 5) return <FitQuestionScreen step={n} />;
  return <Navigate to="/check/1" replace />;
}
