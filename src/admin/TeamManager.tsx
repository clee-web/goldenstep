import {
  type ManagedContent,
  type ManagedTeamMember,
  type TeamMemberInput,
} from '@shared/schemas';
import * as api from '@/lib/adminApi';
import { useAction, useEditor } from './useEditor';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  NumberInput,
  RowActions,
  SectionTitle,
  SuccessBanner,
  TextArea,
  TextInput,
} from './ui';

const blank = (): TeamMemberInput => ({
  name: '',
  role: '',
  bio: '',
  image: '',
  imageAlt: '',
  email: '',
  order: 0,
});

const toDraft = (member: ManagedTeamMember): TeamMemberInput => ({
  name: member.name,
  role: member.role,
  bio: member.bio,
  image: member.image,
  imageAlt: member.imageAlt,
  email: member.email,
  order: member.order,
});

export function TeamManager({
  content,
  refresh,
}: {
  content: ManagedContent;
  /** Re-reads managed content from the server after a successful write. */
  refresh: () => Promise<boolean>;
}) {
  const editor = useEditor<TeamMemberInput>({
    blank,
    onError: (error) =>
      error.error === 'not_found'
        ? 'That team member no longer exists. Reload the dashboard and try again.'
        : error.message,
  });

  const removal = useAction();

  const teamMembers = content.teamMembers;

  const save = async (draft: TeamMemberInput, id: string | null) =>
    id ? api.updateTeamMember(id, draft) : api.createTeamMember(draft);

  /**
   * Every successful write re-reads the server rather than patching local state,
   * so the list can never disagree with what the public site will render.
   */
  const onSubmit = async () => {
    const ok = await editor.submit(save, {
      created: 'Team member published.',
      updated: 'Team member updated.',
    });
    if (ok) await refresh();
  };

  const onDelete = async (member: ManagedTeamMember) => {
    const confirmed = window.confirm(
      `Delete "${member.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    const ok = await removal.run(
      () => api.deleteTeamMember(member.id),
      `Deleted "${member.name}".`,
    );
    if (ok) {
      editor.clearNotice();
      await refresh();
    }
  };

  const error = editor.error ?? removal.error;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title={editor.mode === 'edit' ? 'Edit team member' : 'New team member'}
          description="Published team members appear in the Our Team section on the public site."
        />

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
          noValidate
        >
          <div className="md:col-span-2">
            <Field label="Name" htmlFor="team-name" error={editor.fieldErrors.name}>
              <TextInput
                id="team-name"
                value={editor.draft.name}
                invalid={Boolean(editor.fieldErrors.name)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, name: value }))
                }
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Role" htmlFor="team-role" error={editor.fieldErrors.role}>
              <TextInput
                id="team-role"
                value={editor.draft.role}
                invalid={Boolean(editor.fieldErrors.role)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, role: value }))
                }
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field
              label="Bio"
              htmlFor="team-bio"
              error={editor.fieldErrors.bio}
              hint="A brief description, 10–500 characters."
            >
              <TextArea
                id="team-bio"
                value={editor.draft.bio}
                invalid={Boolean(editor.fieldErrors.bio)}
                onChange={(value) =>
                  editor.setDraft((draft) => ({ ...draft, bio: value }))
                }
              />
            </Field>
          </div>

          <Field
            label="Email"
            htmlFor="team-email"
            error={editor.fieldErrors.email}
            hint="Optional."
          >
            <TextInput
              id="team-email"
              type="email"
              value={editor.draft.email}
              invalid={Boolean(editor.fieldErrors.email)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, email: value }))
              }
            />
          </Field>

          <Field
            label="Display order"
            htmlFor="team-order"
            error={editor.fieldErrors.order}
            hint="Lower numbers appear first. Default is 0."
          >
            <NumberInput
              id="team-order"
              value={editor.draft.order}
              invalid={Boolean(editor.fieldErrors.order)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, order: value }))
              }
            />
          </Field>

          <Field
            label="Image path"
            htmlFor="team-image"
            error={editor.fieldErrors.image}
            hint="Optional. An /uploads path, /assets path or https URL."
          >
            <TextInput
              id="team-image"
              value={editor.draft.image}
              invalid={Boolean(editor.fieldErrors.image)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, image: value }))
              }
            />
          </Field>

          <Field
            label="Image description"
            htmlFor="team-image-alt"
            error={editor.fieldErrors.imageAlt}
            hint="Required when an image is set, so screen readers can describe it."
          >
            <TextInput
              id="team-image-alt"
              value={editor.draft.imageAlt}
              invalid={Boolean(editor.fieldErrors.imageAlt)}
              onChange={(value) =>
                editor.setDraft((draft) => ({ ...draft, imageAlt: value }))
              }
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={editor.busy}>
              {editor.busy
                ? 'Saving…'
                : editor.mode === 'edit'
                  ? 'Save changes'
                  : 'Publish team member'}
            </Button>
            {editor.mode === 'edit' ? (
              <Button variant="ghost" onClick={() => editor.startCreate(blank())}>
                Cancel edit
              </Button>
            ) : null}
          </div>

          <div className="md:col-span-2 space-y-3">
            <ErrorBanner error={error} />
            <SuccessBanner message={editor.notice ?? removal.notice} />
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Published team members" count={teamMembers.length} />

        {teamMembers.length === 0 ? (
          <EmptyState>
            No team members published yet. The public site shows an empty-state message until you publish the first one.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {teamMembers.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-[12px] border border-line p-4"
              >
                <div className="min-w-0 grow">
                  <p className="font-extrabold">{member.name}</p>
                  <p className="mt-1 text-sm text-muted">{member.role}</p>
                  <p className="mt-1.5 text-xs tracking-[0.06em] text-muted uppercase">
                    Order: {member.order}
                  </p>
                </div>
                <RowActions
                  onEdit={() => editor.startEdit(member.id, toDraft(member))}
                  onDelete={() => void onDelete(member)}
                  deleteLabel={`Delete ${member.name}`}
                  disabled={removal.busy}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}