import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AccountDeletionScreen } from '../AccountDeletionScreen';

describe('AccountDeletionScreen', () => {
  it('explains permanent deletion and requires the exact confirmation phrase', async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<AccountDeletionScreen onCancel={jest.fn()} onDelete={onDelete} />);
    const deleteButton = screen.getByRole('button', { name: 'Permanently delete account' });

    expect(screen.getByText('This permanently removes:')).toBeTruthy();
    expect(screen.getByText('Your profile and sign-in access')).toBeTruthy();
    expect(deleteButton.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));

    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    await fireEvent.press(deleteButton);
    expect(onDelete).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('prevents duplicate deletion requests while the first is pending', async () => {
    let resolveDeletion: () => void = () => undefined;
    const onDelete = jest.fn(
      () => new Promise<void>((resolve) => {
        resolveDeletion = resolve;
      }),
    );
    const screen = await render(<AccountDeletionScreen onCancel={jest.fn()} onDelete={onDelete} />);

    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Deleting account' }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true, busy: true }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Deleting account' }));
    expect(onDelete).toHaveBeenCalledTimes(1);

    await act(async () => resolveDeletion());
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('shows a safe retry message and keeps the confirmation when deletion fails', async () => {
    const onDelete = jest.fn().mockRejectedValue(new Error('private backend detail'));
    const screen = await render(<AccountDeletionScreen onCancel={jest.fn()} onDelete={onDelete} />);

    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: 'Permanently delete account' }));

    expect(await screen.findByText("We couldn't delete your account. Please try again.")).toBeTruthy();
    expect(screen.queryByText('private backend detail')).toBeNull();
    expect(screen.getByDisplayValue('DELETE')).toBeTruthy();
  });

  it('lets the user cancel without deleting', async () => {
    const onCancel = jest.fn();
    const onDelete = jest.fn();
    const screen = await render(<AccountDeletionScreen onCancel={onCancel} onDelete={onDelete} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel account deletion' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
