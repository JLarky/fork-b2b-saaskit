import { StrictMode, useEffect, useState } from 'react';
import {
	createBrowserRouter,
	Link,
	Navigate,
	RouterProvider,
	useLocation,
	useNavigate,
	useSearchParams,
} from 'react-router-dom';

import { api, ApiProvider } from '../api';

const routes = () => [
	{
		path: '/survey',
		element: <StartSurvey />,
	},
	{
		path: '/survey/rate-experience',
		element: <RateExperience />,
	},
	{
		path: '/survey/optional-comments',
		element: (
			<ApiProvider>
				<OptionalComments />
			</ApiProvider>
		),
	},
	{
		path: '/survey/thank-you',
		element: <ThankYou />,
	},
	{
		path: '/survey/published',
		element: (
			<ApiProvider>
				<Published />
			</ApiProvider>
		),
	},
];

const router = createBrowserRouter(routes());

export function Survey() {
	return (
		<StrictMode>
			<RouterProvider router={router} />
		</StrictMode>
	);
}

function StartSurvey() {
	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<div className="mb-4 flex gap-4">
				<Link
					to="/survey/rate-experience"
					className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
				>
					Start survey
				</Link>
				<Link
					to="/survey/published"
					className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
				>
					Public surveys
				</Link>
			</div>
			<a href="/" className="text-blue-500 hover:underline">
				Return to home page
			</a>
		</div>
	);
}

function validateRating(rating: string) {
	const ratingInt = Number(rating);
	return ratingInt >= 1 && ratingInt <= 5 ? String(ratingInt) : undefined;
}

function RateExperience() {
	const state = useLocation().state as { rating?: string };
	const rating = state?.rating ?? '';
	const navigate = useNavigate();
	const validRating = validateRating(rating);

	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<h2 className="mb-4 px-8 text-2xl">Please rate your experience from 1 to 5</h2>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (validRating) {
						const search = new URLSearchParams({ rating: validRating });
						navigate('/survey/optional-comments?' + search.toString());
					}
				}}
				className="w-full px-8 sm:w-96"
			>
				<input
					type="number"
					min="1"
					max="5"
					defaultValue={rating}
					onChange={(e) =>
						navigate('/survey/rate-experience', {
							state: { rating: e.target.value },
							replace: true,
						})
					}
					className="mb-4 w-full rounded-md border border-gray-200 px-3 py-2"
					required
				/>
				<button
					disabled={!validRating}
					type="submit"
					className="w-full rounded-md bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
				>
					Next
				</button>
			</form>
			<Link to="/survey" className="mt-4 text-blue-500 hover:underline">
				Back
			</Link>
		</div>
	);
}

function OptionalComments() {
	const [isTooLong, setIsTooLong] = useState(false);
	const [search] = useSearchParams();
	const rating = search.get('rating') || '';
	const validRating = validateRating(rating);
	const postSurveyMutation = api.surveys.postSurvey.useMutation();
	if (validRating === undefined) {
		return <Navigate to="/survey/rate-experience" />;
	}

	if (postSurveyMutation.isSuccess) {
		return <Navigate to="/survey/thank-you" />;
	}

	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<h2 className="mb-4 text-2xl">Any comments or suggestions?</h2>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					const form = e.currentTarget;
					const formData = Object.fromEntries(new FormData(form));
					postSurveyMutation.mutate(formData as never);
				}}
				className="w-full px-8 sm:w-96"
			>
				<input type="hidden" name="rating" value={rating} />
				<textarea
					name="comments"
					className="mb-2 w-full rounded-md border border-gray-200 px-3 py-2"
					placeholder="optional (max 1000 characters)"
					onKeyDown={(e) => {
						if (e.key === 'Enter' && e.metaKey) {
							e.currentTarget.form?.requestSubmit();
						}
					}}
					onInput={(e) => {
						setIsTooLong(e.currentTarget.value.length > 1200);
					}}
				/>
				<fieldset className="mb-2">
					<label>
						<input type="checkbox" className="mr-2" name="is_public" />
						Makes it public{' '}
						<span className="text-sm">(your comment will be visible to everyone)</span>
					</label>
				</fieldset>
				{postSurveyMutation.isError && (
					<p className="mb-2 rounded-md bg-red-100 p-2 text-red-500">
						Error!{' '}
						{postSurveyMutation.error.data?.code === 'BAD_REQUEST'
							? 'Invlid form data'
							: 'Unknown error'}
					</p>
				)}
				<button
					disabled={postSurveyMutation.isLoading || isTooLong}
					type="submit"
					className="w-full rounded-md bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
				>
					Submit{postSurveyMutation.isLoading ? 'ting' : ''}
				</button>
			</form>
			<Link
				to="/survey/rate-experience"
				state={{ rating }}
				className="mt-4 text-blue-500 hover:underline"
			>
				Back
			</Link>
		</div>
	);
}

function ThankYou() {
	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<h2 className="mb-4 text-2xl">Thank you for participating in our survey!</h2>
			<Link to="/survey" className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
				Return back to survey home page
			</Link>
		</div>
	);
}

function useWaited() {
	const [waited, setWaited] = useState(false);
	useEffect(() => {
		setTimeout(() => {
			setWaited(true);
		}, 350);
	}, []);
	return waited;
}

function Published() {
	const postSurveyMutation = api.surveys.getPublic.useQuery(undefined as never);

	const waited = useWaited();
	if (!waited && postSurveyMutation.isLoading) {
		return null;
	}

	return (
		<div className="flex flex-col items-center justify-center py-20">
			<h2 className="mb-4 text-2xl">Thank you to everyone who participated in the survey</h2>
			<Link
				to="/survey/rate-experience"
				className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
			>
				Add your own comment!
			</Link>
			<div className="my-4 w-full sm:w-[500px] lg:w-[800px]">
				<h3 className="mb-2 text-xl">
					{!postSurveyMutation.isLoading && postSurveyMutation.data?.length === 0
						? 'No comments yet'
						: 'Comments'}
				</h3>
				<ul className="list-inside list-disc">
					{postSurveyMutation.isLoading && <li>Loading...</li>}
					{postSurveyMutation.data?.map((survey) => (
						<li key={survey.id}>
							{survey.rating} out of 5 on {survey.createdAt.toLocaleString()}
							{survey.comments && (
								<>
									<br />
									<span className="text-sm">{survey.comments}</span>
								</>
							)}
						</li>
					))}
				</ul>
			</div>
			<Link to="/survey" className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
				Return back to survey home page
			</Link>
		</div>
	);
}
