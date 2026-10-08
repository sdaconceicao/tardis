// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAccountAvatar } from "./AccountAvatar.hooks";

vi.mock("../../../../modules/identity/auth-client", () => ({
	authClient: { updateUser: vi.fn() },
}));

afterEach(cleanup);

it("keeps uploader callbacks and the value stable across feedback changes", () => {
	const { result } = renderHook(() => useAccountAvatar(null));
	const callbacks = {
		onChange: result.current.onChange,
		onRemove: result.current.onRemove,
		onRetry: result.current.onRetry,
		onReject: result.current.reject,
		value: result.current.value,
	};
	act(() => result.current.reject([], "maxSize"));
	expect(result.current.message).toBe("Image must be under 500 KB.");
	expect(result.current.onChange).toBe(callbacks.onChange);
	expect(result.current.onRemove).toBe(callbacks.onRemove);
	expect(result.current.onRetry).toBe(callbacks.onRetry);
	expect(result.current.reject).toBe(callbacks.onReject);
	expect(result.current.value).toBe(callbacks.value);
});
