import { Radio, RadioGroup, TextArea, TextField } from "@code-x/lago";
import type { CreateEventController } from "./CreateEventPage.hooks";
import css from "./CreateEventPage.module.css";
import type { Draft } from "./CreateEventPage.utils";

type Props = Pick<CreateEventController, "draft" | "update">;

export function EventDetailsFields({ draft, update }: Props) {
	return (
		<section className={css.panel} aria-labelledby="details-heading">
			<h2 id="details-heading">Event details</h2>
			<TextField
				label="Event name"
				value={draft.title}
				onChange={(value) => update("title", value)}
				isRequired
				maxLength={200}
			/>
			<TextArea
				label="Description"
				value={draft.description}
				onChange={(value) => update("description", value)}
				maxLength={10000}
			/>
			<RadioGroup
				label="Visibility"
				value={draft.visibility}
				onChange={(value) => update("visibility", value as Draft["visibility"])}
			>
				<Radio value="private" description="Only you can see it">
					Private
				</Radio>
				<Radio value="public" description="Anyone can find it">
					Public
				</Radio>
			</RadioGroup>
		</section>
	);
}
