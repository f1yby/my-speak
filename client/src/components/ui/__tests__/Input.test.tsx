import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('should render an input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('should render a label when provided', () => {
    render(<Input label="Name" />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('should not render a label when not provided', () => {
    const { container } = render(<Input />);
    expect(container.querySelector('label')).toBeNull();
  });

  it('should display error message when error is provided', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should apply error border style when error is present', () => {
    render(<Input error="Error" placeholder="test" />);
    const input = screen.getByPlaceholderText('test');
    expect(input.className).toContain('border-red-500');
  });

  it('should apply custom className', () => {
    render(<Input className="my-custom" placeholder="test" />);
    const input = screen.getByPlaceholderText('test');
    expect(input.className).toContain('my-custom');
  });

  it('should forward ref correctly', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
