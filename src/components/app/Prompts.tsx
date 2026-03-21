import clsx from 'clsx';
import { Link } from 'react-router-dom';

import { websiteTitle } from '../../constants';
import { api, useApiUtils } from '../api';
import { useRequireActiveOrg } from '../propelauth';
import { Layout } from './Layout';

export function Prompts() {
	const apiUtils = useApiUtils();

	const { auth, activeOrg } = useRequireActiveOrg();
	const userId = auth.loading === false && auth.user?.userId;
	const orgId = activeOrg?.orgId || '';
	const promptsQuery = api.prompts.getPrompts.useQuery(
		{},
		{
			enabled: !!orgId,
			staleTime: 1000,
		}
	);
	const deletePromptMutation = api.prompts.deletePrompt.useMutation({
		onMutate: async ({ promptId }) => {
			await apiUtils.prompts.getPrompts.cancel({});
			const previousPrompts = apiUtils.prompts.getPrompts.getData({});
			apiUtils.prompts.getPrompts.setData({}, (oldData) =>
				oldData?.filter((prompt) => prompt.promptId !== promptId)
			);
			return { previousPrompts };
		},
		onError: (_err, _variables, context) => {
			const ctx = context as { previousPrompts?: typeof promptsQuery.data } | undefined;
			if (ctx?.previousPrompts) {
				apiUtils.prompts.getPrompts.setData({}, ctx.previousPrompts);
			}
		},
		onSettled: () => {
			apiUtils.prompts.getPrompts.invalidate({});
		},
	});

	return (
		<Layout title={`${websiteTitle} / Prompts`}>
			<div className="mt-4 flex flex-col gap-10 rounded-md border border-gray-300 px-4 py-8 sm:px-6 lg:px-8">
				<div className="">
					<Link
						to="/app/prompts/create"
						type="button"
						className="rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
					>
						Create a prompt
					</Link>
				</div>

				{promptsQuery.data?.length === 0 && (
					<div className="flex flex-col gap-3 text-sm text-gray-700">
						<div>No prompts yet!</div>
						<div>Press ☝️ button to create one</div>
					</div>
				)}

				{(promptsQuery.data?.length || 0) > 0 && (
					<div className="sm:flex sm:items-center">
						<div className="flex flex-col gap-2">
							<h1 className="text-base font-semibold leading-6 text-gray-900">
								Prompts created by your organization
							</h1>
							<p className="text-sm text-gray-700">
								List of all the prompts created by you and your friends
							</p>
						</div>
					</div>
				)}

				{(promptsQuery.data?.length || 0) > 0 && (
					<Table>
						{promptsQuery.data?.map((prompt, index) => (
							<tr
								key={prompt.promptId}
								className={clsx(
									index % 2 === 0 && 'bg-gray-50',
									deletePromptMutation.isLoading &&
										deletePromptMutation.variables?.promptId === prompt.promptId &&
										'opacity-50'
								)}
							>
								<td className="break-all py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 lg:pl-8">
									<Link
										to={`/app/prompts/${prompt.promptId}`}
										className="text-indigo-600 underline hover:text-indigo-900"
									>
										{prompt.title}
										{prompt.isPublic ? ' (Public)' : ''}
									</Link>
								</td>
								<td className="break-all px-3 py-4 text-sm text-gray-500">
									{prompt._meta.user?.name || prompt._meta.user?.email || prompt.userId}
									{prompt.userId === userId ? ' (You)' : ''}
								</td>
								<td className="relative flex flex-col items-start gap-2 whitespace-nowrap break-all py-4 pl-3 pr-4 text-right text-sm font-medium sm:flex-row sm:gap-6 sm:pr-6 lg:pr-8">
									<Link
										to={`/app/prompts/${prompt.promptId}/edit`}
										className="text-indigo-600 hover:text-indigo-900"
									>
										Edit<span className="sr-only">, prompt</span>
									</Link>
									<button
										className="text-indigo-600 hover:text-indigo-900"
										onClick={() => {
											const confirm = window.confirm(
												'Are you sure you want to delete this prompt?'
											);
											if (confirm) {
												deletePromptMutation.mutate({ promptId: prompt.promptId });
											}
										}}
									>
										Delete<span className="sr-only">, prompt</span>
									</button>
								</td>
							</tr>
						))}
					</Table>
				)}
			</div>
		</Layout>
	);
}

const Table = ({ children }: { children: React.ReactNode }) => {
	return (
		<div className="flow-root">
			<div className="">
				<div className="inline-block min-w-full py-2 align-middle">
					<table className="min-w-full divide-y divide-gray-300">
						<thead>
							<tr>
								<th
									scope="col"
									className="-rotate-90 pb-8 text-sm font-semibold text-gray-900 sm:rotate-0 sm:break-all sm:pb-2 sm:text-left"
								>
									Prompt
								</th>
								<th
									scope="col"
									className="-rotate-90 pb-8 text-sm font-semibold text-gray-900 sm:rotate-0 sm:break-all sm:pb-2 sm:text-left"
								>
									Creator
								</th>
								<th
									scope="col"
									className="-rotate-90 pb-8 text-sm font-semibold text-gray-900 sm:rotate-0 sm:break-all sm:pb-2 sm:text-left"
								>
									<span className="sr-only">Delete</span>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};
