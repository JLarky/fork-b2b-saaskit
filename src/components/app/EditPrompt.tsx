import { useParams } from 'react-router-dom';

import { websiteTitle } from '../../constants';
import { api } from '../api';
import { EditPromptControls } from './CreatePrompt';
import { Layout } from './Layout';
import { usePromptErrorPage } from './usePromptErrorPage';

export function EditPrompt() {
	const { promptId } = useParams<{ promptId: string }>();
	const promptsQuery = api.prompts.getPrompt.useQuery(
		{
			promptId: promptId!,
		},
		{
			enabled: !!promptId,
			staleTime: 1000,
			retry: (retry, error) => {
				return retry < 3 && !error.data?.code;
			},
		}
	);

	const errorPage = usePromptErrorPage(promptsQuery.status, promptsQuery.error?.data?.code as never);

	if (errorPage) {
		return errorPage;
	}

	const data = promptsQuery.data;
	return (
		<Layout
			title={`${websiteTitle} / ${data?.prompt.title ? data?.prompt.title + ' / ' : ''}Edit prompt`}
		>
			{data && (
				<EditPromptControls
					promptId={data.prompt.promptId}
					promptName={data.prompt.title}
					promptDescription={data.prompt.description}
					promptTags={data.prompt.tags}
					promptPrivacyLevel={data.prompt.privacyLevel as 'public' | 'team' | 'unlisted' | 'private'}
					template={data.prompt.template}
				/>
			)}
			{promptsQuery.isLoading && <div>Loading...</div>}
			{promptsQuery.error && <div className="text-red-500">{promptsQuery.error.message}</div>}
		</Layout>
	);
}
