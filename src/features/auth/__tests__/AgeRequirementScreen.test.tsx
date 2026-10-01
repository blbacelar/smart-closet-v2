import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AgeRequirementScreen } from '../AgeRequirementScreen';

describe('AgeRequirementScreen', () => {
  it('blocks underage accounts without calling the server', async () => {
    const onConfirm = jest.fn();
    const screen = await render(<AgeRequirementScreen onConfirm={onConfirm} />);

    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '2012-01-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm age eligibility' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Fitly is available only to people aged 18 or older.',
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms an eligible existing account without sending the birth date', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const screen = await render(<AgeRequirementScreen onConfirm={onConfirm} />);

    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '1990-01-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm age eligibility' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith());
  });

  it('shows a safe retry message when confirmation fails', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('database detail'));
    const screen = await render(<AgeRequirementScreen onConfirm={onConfirm} />);

    await fireEvent.changeText(screen.getByLabelText('Date of birth'), '1990-01-01');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm age eligibility' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not confirm account eligibility. Try again.',
    );
  });
});
